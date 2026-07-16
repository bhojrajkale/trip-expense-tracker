import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import type { Trip, Expense, Member, Activity, ActivityType, JoinRequest } from '../types'
import { loadActiveTripId, saveActiveTripId } from '../utils/storage'
import {
  subscribeTrips,
  subscribeExpenses,
  subscribeJoinRequests,
  deleteJoinRequest,
  migrateLegacyData,
  saveTrip,
  savePreview,
  removeTrip,
  saveExpense,
  removeExpense,
  logActivity,
  memberUidsFor,
} from '../utils/firestore'

// Pure: how an approved join request folds into a trip's members. Isolated
// from useStore so the four branches (claim / conflicting claim /
// already-a-member / new) can be read and tested without the surrounding
// dispatch/save/log plumbing.
function mergeApprovedMember(
  members: Member[],
  req: JoinRequest
): { members: Member[]; joinedName: string; changed: boolean; conflict: boolean } {
  const claimTarget = req.claimMemberId && members.find((m) => m.id === req.claimMemberId)
  if (claimTarget) {
    if (claimTarget.uid === req.uid) {
      // Already claimed by this same account (double-approve) — nothing to change
      return { members, joinedName: claimTarget.name, changed: false, conflict: false }
    }
    if (claimTarget.uid) {
      // This member is already linked to a DIFFERENT account than the
      // requester — approving would silently steal that person's identity
      // (they'd vanish from memberUids and lose all trip access). The
      // preview's members[].uid is visible to any invite-link holder, so a
      // request can name any already-claimed member on purpose. Refuse.
      return { members, joinedName: claimTarget.name, changed: false, conflict: true }
    }
    // Claim: link the account onto the chosen offline member entry
    return {
      members: members.map((m) =>
        m.id === req.claimMemberId
          ? { ...m, uid: req.uid, email: req.email ?? undefined, photoURL: req.photoURL ?? undefined }
          : m
      ),
      joinedName: claimTarget.name,
      changed: true,
      conflict: false,
    }
  }
  if (members.some((m) => m.uid === req.uid)) {
    // Already a member (double-approve) — nothing to change
    return { members, joinedName: req.name, changed: false, conflict: false }
  }
  return {
    members: [
      ...members,
      { id: crypto.randomUUID(), name: req.name, uid: req.uid, email: req.email ?? undefined, photoURL: req.photoURL ?? undefined },
    ],
    joinedName: req.name,
    changed: true,
    conflict: false,
  }
}

interface State {
  trips: Trip[]
  expenses: Expense[] // active trip's expenses only (realtime subscription)
  activeTripId: string | null
}

type Action =
  | { type: 'SET_TRIPS'; trips: Trip[] }
  | { type: 'SET_EXPENSES'; expenses: Expense[] }
  | { type: 'SET_ACTIVE_TRIP'; id: string | null }
  | { type: 'ADD_TRIP'; trip: Trip }
  | { type: 'UPDATE_TRIP'; trip: Trip }
  | { type: 'DELETE_TRIP'; id: string }
  | { type: 'ADD_EXPENSE'; expense: Expense }
  | { type: 'UPDATE_EXPENSE'; expense: Expense }
  | { type: 'DELETE_EXPENSE'; id: string }
  | { type: 'ADD_MEMBER'; tripId: string; member: Member }
  | { type: 'REMOVE_MEMBER'; tripId: string; memberId: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_TRIPS':
      return { ...state, trips: action.trips }
    case 'SET_EXPENSES':
      return { ...state, expenses: action.expenses }
    case 'SET_ACTIVE_TRIP':
      return { ...state, activeTripId: action.id }
    case 'ADD_TRIP':
      return { ...state, trips: [...state.trips, action.trip] }
    case 'UPDATE_TRIP':
      return { ...state, trips: state.trips.map((t) => (t.id === action.trip.id ? action.trip : t)) }
    case 'DELETE_TRIP': {
      const trips = state.trips.filter((t) => t.id !== action.id)
      const expenses = state.expenses.filter((e) => e.tripId !== action.id)
      const activeTripId =
        state.activeTripId === action.id ? (trips[0]?.id ?? null) : state.activeTripId
      return { trips, expenses, activeTripId }
    }
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.expense] }
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e)),
      }
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) }
    case 'ADD_MEMBER':
      return {
        ...state,
        trips: state.trips.map((t) =>
          t.id === action.tripId ? { ...t, members: [...t.members, action.member] } : t
        ),
      }
    case 'REMOVE_MEMBER':
      return {
        ...state,
        trips: state.trips.map((t) =>
          t.id === action.tripId
            ? { ...t, members: t.members.filter((m) => m.id !== action.memberId) }
            : t
        ),
      }
    default:
      return state
  }
}

// 'denied' = Firestore rejected the read (e.g. account not on the allowlist);
// 'network' = transient/offline. Lets the UI show an honest screen instead of
// hanging forever on the loading state.
export type LoadError = 'denied' | 'network' | null

export function useStore(uid: string | null) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<LoadError>(null)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [state, dispatch] = useReducer(reducer, { trips: [], expenses: [], activeTripId: null })

  // Always-current ref so callbacks don't go stale
  const stateRef = useRef(state)
  stateRef.current = state

  // Trip ids seen in the previous snapshot — used to distinguish "removed
  // from a trip" (reset active) from "just joined, snapshot not here yet"
  // (keep active and wait).
  const prevTripIdsRef = useRef<Set<string>>(new Set())

  // Trips whose tripsPreview doc we've refreshed this session — backfills
  // trips created before that collection existed (invite links for them
  // otherwise 404 forever, since saveTrip is the only other writer and
  // nothing else touches an untouched old trip). Once-per-session, not
  // once-per-doc-check, to avoid an extra read per trip on every snapshot.
  const syncedPreviewsRef = useRef<Set<string>>(new Set())

  // Migrate legacy /users/{uid}/… data, then subscribe to shared trips
  useEffect(() => {
    if (!uid) {
      dispatch({ type: 'SET_TRIPS', trips: [] })
      dispatch({ type: 'SET_EXPENSES', expenses: [] })
      dispatch({ type: 'SET_ACTIVE_TRIP', id: null })
      prevTripIdsRef.current = new Set()
      syncedPreviewsRef.current = new Set()
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    let unsub: (() => void) | undefined
    let cancelled = false

    migrateLegacyData(uid)
      .catch((e) => console.error('migration failed (will retry next login)', e))
      .then(() => {
        if (cancelled) return
        unsub = subscribeTrips(
          uid,
          (trips) => {
            dispatch({ type: 'SET_TRIPS', trips })

            for (const trip of trips) {
              if (syncedPreviewsRef.current.has(trip.id)) continue
              syncedPreviewsRef.current.add(trip.id)
              savePreview(trip).catch(console.error)
            }

            const ids = new Set(trips.map((t) => t.id))
            const current = stateRef.current.activeTripId
            if (!current) {
              const savedId = loadActiveTripId()
              const activeId =
                trips.find((t) => t.id === savedId)?.id ??
                trips.find((t) => !t.archived)?.id ??
                trips[0]?.id ??
                null
              dispatch({ type: 'SET_ACTIVE_TRIP', id: activeId })
            } else if (!ids.has(current) && prevTripIdsRef.current.has(current)) {
              // Trip disappeared (deleted, or we were removed) — fall back
              const fallback = trips.find((t) => !t.archived) ?? trips[0]
              dispatch({ type: 'SET_ACTIVE_TRIP', id: fallback?.id ?? null })
            }
            prevTripIdsRef.current = ids
            setLoadError(null)
            setLoading(false)
          },
          (err) => {
            // Never leave the app stuck on the loading screen — surface it.
            if (cancelled) return
            setLoadError(err.code === 'permission-denied' ? 'denied' : 'network')
            setLoading(false)
          }
        )
      })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [uid])

  // Realtime expenses for the active trip only
  useEffect(() => {
    if (!uid || !state.activeTripId) {
      dispatch({ type: 'SET_EXPENSES', expenses: [] })
      return
    }
    return subscribeExpenses(state.activeTripId, (expenses) =>
      dispatch({ type: 'SET_EXPENSES', expenses })
    )
  }, [uid, state.activeTripId])

  // Persist active trip selection locally (it's a UI preference, not data)
  useEffect(() => {
    saveActiveTripId(state.activeTripId)
  }, [state.activeTripId])

  // Owner-only: realtime pending join requests for the active trip. The rules
  // only allow the owner to list them, so non-owners keep an empty array.
  const activeOwnerUid = state.trips.find((t) => t.id === state.activeTripId)?.ownerUid
  useEffect(() => {
    if (!uid || !state.activeTripId || activeOwnerUid !== uid) {
      setJoinRequests([])
      return
    }
    return subscribeJoinRequests(state.activeTripId, setJoinRequests, (err) => {
      // The listener already console.errors internally; this just makes it
      // explicit that an empty list here may mean "couldn't load," not
      // "no pending requests" — same transient-error class as subscribeTrips.
      console.error('pending join requests unavailable', err)
      setJoinRequests([])
    })
  }, [uid, state.activeTripId, activeOwnerUid])

  const activeTrip = state.trips.find((t) => t.id === state.activeTripId) ?? null
  const activeExpenses = state.expenses.filter((e) => e.tripId === state.activeTripId)

  const setActiveTrip = useCallback(
    (id: string | null) => dispatch({ type: 'SET_ACTIVE_TRIP', id }),
    []
  )

  // Fire-and-forget activity log entry; actor name resolved from the trip's
  // members at write time so feed entries survive later member removal
  const log = useCallback(
    (tripId: string, type: ActivityType, extra?: Partial<Activity>) => {
      if (!uid) return
      const trip = stateRef.current.trips.find((t) => t.id === tripId)
      const actorName = trip?.members.find((m) => m.uid === uid)?.name ?? 'Someone'
      logActivity(tripId, {
        id: crypto.randomUUID(),
        type,
        actorUid: uid,
        actorName,
        at: new Date().toISOString(),
        ...extra,
      }).catch(console.error)
    },
    [uid]
  )

  const addTrip = useCallback(
    (draft: Omit<Trip, 'ownerUid' | 'memberUids'>) => {
      if (!uid) return
      const trip: Trip = {
        ...draft,
        ownerUid: uid,
        memberUids: memberUidsFor({ ownerUid: uid, members: draft.members }),
      }
      dispatch({ type: 'ADD_TRIP', trip })
      saveTrip(trip).catch(console.error)
    },
    [uid]
  )

  const updateTrip = useCallback((trip: Trip) => {
    dispatch({ type: 'UPDATE_TRIP', trip })
    saveTrip(trip).catch(console.error)
    log(trip.id, 'trip_updated')
  }, [log])

  const toggleSettlementPaid = useCallback((tripId: string, from: string, to: string) => {
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (!trip) return
    const paid = trip.paidSettlements ?? []
    const idx = paid.findIndex((p) => p.from === from && p.to === to)
    const updated: Trip = {
      ...trip,
      paidSettlements: idx >= 0
        ? paid.filter((_, i) => i !== idx)
        : [...paid, { from, to, paidAt: new Date().toISOString().slice(0, 10) }],
    }
    dispatch({ type: 'UPDATE_TRIP', trip: updated })
    saveTrip(updated).catch(console.error)
    const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'
    log(tripId, idx >= 0 ? 'settlement_unpaid' : 'settlement_paid', {
      fromName: name(from),
      toName: name(to),
    })
  }, [log])

  const toggleArchiveTrip = useCallback((id: string) => {
    const trip = stateRef.current.trips.find((t) => t.id === id)
    if (!trip) return
    const updated: Trip = { ...trip, archived: !trip.archived }
    dispatch({ type: 'UPDATE_TRIP', trip: updated })
    saveTrip(updated).catch(console.error)
    // Archiving the active trip switches to the first non-archived one
    if (!trip.archived && stateRef.current.activeTripId === id) {
      const next = stateRef.current.trips.find((t) => t.id !== id && !t.archived)
      dispatch({ type: 'SET_ACTIVE_TRIP', id: next?.id ?? null })
    }
  }, [])

  const deleteTrip = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRIP', id })
    removeTrip(id).catch(console.error)
  }, [])

  const addExpense = useCallback(
    (draft: Omit<Expense, 'createdByUid'>) => {
      if (!uid) return
      const expense: Expense = { ...draft, createdByUid: uid }
      dispatch({ type: 'ADD_EXPENSE', expense })
      saveExpense(expense.tripId, expense).catch(console.error)
      log(expense.tripId, 'expense_added', {
        amount: expense.amount,
        category: expense.category,
        customCategory: expense.customCategory,
      })
    },
    [uid, log]
  )

  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', expense })
    saveExpense(expense.tripId, expense).catch(console.error)
    log(expense.tripId, 'expense_updated', {
      amount: expense.amount,
      category: expense.category,
      customCategory: expense.customCategory,
    })
  }, [log])

  const deleteExpense = useCallback((id: string) => {
    const expense = stateRef.current.expenses.find((e) => e.id === id)
    dispatch({ type: 'DELETE_EXPENSE', id })
    if (expense) {
      removeExpense(expense.tripId, id).catch(console.error)
      log(expense.tripId, 'expense_deleted', {
        amount: expense.amount,
        category: expense.category,
        customCategory: expense.customCategory,
      })
    }
  }, [log])

  // Accepts a batch: adding contacts one-by-one would base each Firestore
  // write on a stale trip copy, so only the last member would survive
  const addMembers = useCallback((tripId: string, members: Member[]) => {
    if (members.length === 0) return
    members.forEach((member) => dispatch({ type: 'ADD_MEMBER', tripId, member }))
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (trip) {
      const updated = { ...trip, members: [...trip.members, ...members] }
      saveTrip({ ...updated, memberUids: memberUidsFor(updated) }).catch(console.error)
      members.forEach((m) => log(tripId, 'member_added', { memberName: m.name }))
    }
  }, [log])

  const addMember = useCallback(
    (tripId: string, member: Member) => addMembers(tripId, [member]),
    [addMembers]
  )

  const removeMember = useCallback((tripId: string, memberId: string) => {
    const removedName = stateRef.current.trips
      .find((t) => t.id === tripId)?.members.find((m) => m.id === memberId)?.name
    dispatch({ type: 'REMOVE_MEMBER', tripId, memberId })
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (trip) {
      const updated = { ...trip, members: trip.members.filter((m) => m.id !== memberId) }
      saveTrip({ ...updated, memberUids: memberUidsFor(updated) }).catch(console.error)
      if (removedName) log(tripId, 'member_removed', { memberName: removedName })
    }
  }, [log])

  // Owner approves a pending join request: add the requester as a member
  // (idempotent — keyed by uid, so re-approving never duplicates), then delete
  // the request. Done owner-side because only the owner can add to memberUids.
  // Returns 'approved' | 'already-member' | 'conflict' so the caller can
  // show the owner a clear signal instead of an approval silently no-op'ing.
  const approveJoinRequest = useCallback((tripId: string, req: JoinRequest) => {
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (!trip) return 'already-member' as const

    const { members, joinedName, changed, conflict } = mergeApprovedMember(trip.members, req)

    if (conflict) {
      // Refuse the write entirely — leave the request in place so the owner
      // can inspect and explicitly decline it themselves.
      return 'conflict' as const
    }

    if (!changed) {
      // Double-approve of someone already a member — just clear the stale
      // request, no trip write or duplicate "joined" activity entry needed.
      deleteJoinRequest(tripId, req.uid).catch(console.error)
      return 'already-member' as const
    }

    const updated: Trip = { ...trip, members, memberUids: memberUidsFor({ ...trip, members }) }
    dispatch({ type: 'UPDATE_TRIP', trip: updated })
    // Add the member first, then drop the request (orphan-on-crash is harmless)
    saveTrip(updated)
      .then(() => deleteJoinRequest(tripId, req.uid))
      .catch(console.error)
    log(tripId, 'member_joined', { memberName: joinedName })
    return 'approved' as const
  }, [log])

  const rejectJoinRequest = useCallback((tripId: string, reqUid: string) => {
    deleteJoinRequest(tripId, reqUid).catch(console.error)
  }, [])

  return {
    loading,
    loadError,
    joinRequests,
    trips: state.trips,
    expenses: state.expenses,
    activeTripId: state.activeTripId,
    activeTrip,
    activeExpenses,
    setActiveTrip,
    addTrip,
    updateTrip,
    toggleArchiveTrip,
    deleteTrip,
    addExpense,
    updateExpense,
    deleteExpense,
    addMember,
    addMembers,
    removeMember,
    toggleSettlementPaid,
    approveJoinRequest,
    rejectJoinRequest,
  }
}
