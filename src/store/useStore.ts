import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import type { Trip, Expense, Member } from '../types'
import { loadActiveTripId, saveActiveTripId } from '../utils/storage'
import {
  subscribeTrips,
  subscribeExpenses,
  migrateLegacyData,
  saveTrip,
  removeTrip,
  saveExpense,
  removeExpense,
  memberUidsFor,
} from '../utils/firestore'

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

export function useStore(uid: string | null) {
  const [loading, setLoading] = useState(true)
  const [state, dispatch] = useReducer(reducer, { trips: [], expenses: [], activeTripId: null })

  // Always-current ref so callbacks don't go stale
  const stateRef = useRef(state)
  stateRef.current = state

  // Trip ids seen in the previous snapshot — used to distinguish "removed
  // from a trip" (reset active) from "just joined, snapshot not here yet"
  // (keep active and wait).
  const prevTripIdsRef = useRef<Set<string>>(new Set())

  // Migrate legacy /users/{uid}/… data, then subscribe to shared trips
  useEffect(() => {
    if (!uid) {
      dispatch({ type: 'SET_TRIPS', trips: [] })
      dispatch({ type: 'SET_EXPENSES', expenses: [] })
      dispatch({ type: 'SET_ACTIVE_TRIP', id: null })
      prevTripIdsRef.current = new Set()
      setLoading(false)
      return
    }

    setLoading(true)
    let unsub: (() => void) | undefined
    let cancelled = false

    migrateLegacyData(uid)
      .catch((e) => console.error('migration failed (will retry next login)', e))
      .then(() => {
        if (cancelled) return
        unsub = subscribeTrips(uid, (trips) => {
          dispatch({ type: 'SET_TRIPS', trips })

          const ids = new Set(trips.map((t) => t.id))
          const current = stateRef.current.activeTripId
          if (!current) {
            const savedId = loadActiveTripId()
            const activeId = trips.find((t) => t.id === savedId)?.id ?? trips[0]?.id ?? null
            dispatch({ type: 'SET_ACTIVE_TRIP', id: activeId })
          } else if (!ids.has(current) && prevTripIdsRef.current.has(current)) {
            // Trip disappeared (deleted, or we were removed) — fall back
            dispatch({ type: 'SET_ACTIVE_TRIP', id: trips[0]?.id ?? null })
          }
          prevTripIdsRef.current = ids
          setLoading(false)
        })
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

  const activeTrip = state.trips.find((t) => t.id === state.activeTripId) ?? null
  const activeExpenses = state.expenses.filter((e) => e.tripId === state.activeTripId)

  const setActiveTrip = useCallback(
    (id: string | null) => dispatch({ type: 'SET_ACTIVE_TRIP', id }),
    []
  )

  const addTrip = useCallback(
    (draft: Omit<Trip, 'ownerUid' | 'memberUids'>) => {
      if (!uid) return
      const trip: Trip = { ...draft, ownerUid: uid, memberUids: [uid] }
      dispatch({ type: 'ADD_TRIP', trip })
      saveTrip(trip).catch(console.error)
    },
    [uid]
  )

  const updateTrip = useCallback((trip: Trip) => {
    dispatch({ type: 'UPDATE_TRIP', trip })
    saveTrip(trip).catch(console.error)
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
    },
    [uid]
  )

  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', expense })
    saveExpense(expense.tripId, expense).catch(console.error)
  }, [])

  const deleteExpense = useCallback((id: string) => {
    const expense = stateRef.current.expenses.find((e) => e.id === id)
    dispatch({ type: 'DELETE_EXPENSE', id })
    if (expense) removeExpense(expense.tripId, id).catch(console.error)
  }, [])

  const addMember = useCallback((tripId: string, member: Member) => {
    dispatch({ type: 'ADD_MEMBER', tripId, member })
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (trip) {
      const updated = { ...trip, members: [...trip.members, member] }
      saveTrip({ ...updated, memberUids: memberUidsFor(updated) }).catch(console.error)
    }
  }, [])

  const removeMember = useCallback((tripId: string, memberId: string) => {
    dispatch({ type: 'REMOVE_MEMBER', tripId, memberId })
    const trip = stateRef.current.trips.find((t) => t.id === tripId)
    if (trip) {
      const updated = { ...trip, members: trip.members.filter((m) => m.id !== memberId) }
      saveTrip({ ...updated, memberUids: memberUidsFor(updated) }).catch(console.error)
    }
  }, [])

  return {
    loading,
    trips: state.trips,
    expenses: state.expenses,
    activeTripId: state.activeTripId,
    activeTrip,
    activeExpenses,
    setActiveTrip,
    addTrip,
    updateTrip,
    deleteTrip,
    addExpense,
    updateExpense,
    deleteExpense,
    addMember,
    removeMember,
  }
}
