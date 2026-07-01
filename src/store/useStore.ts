import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import type { Trip, Expense, Member } from '../types'
import { loadActiveTripId, saveActiveTripId } from '../utils/storage'
import {
  loadTrips,
  loadExpenses,
  saveTrip,
  removeTrip,
  saveExpense,
  removeExpense,
} from '../utils/firestore'

interface State {
  trips: Trip[]
  expenses: Expense[]
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

  // Load from Firestore when uid changes (login / logout)
  useEffect(() => {
    if (!uid) {
      dispatch({ type: 'SET_TRIPS', trips: [] })
      dispatch({ type: 'SET_EXPENSES', expenses: [] })
      dispatch({ type: 'SET_ACTIVE_TRIP', id: null })
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([loadTrips(uid), loadExpenses(uid)]).then(([trips, expenses]) => {
      dispatch({ type: 'SET_TRIPS', trips })
      dispatch({ type: 'SET_EXPENSES', expenses })
      const savedId = loadActiveTripId()
      const activeId = trips.find((t) => t.id === savedId)?.id ?? trips[0]?.id ?? null
      dispatch({ type: 'SET_ACTIVE_TRIP', id: activeId })
      setLoading(false)
    })
  }, [uid])

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
    (trip: Trip) => {
      dispatch({ type: 'ADD_TRIP', trip })
      if (uid) saveTrip(uid, trip).catch(console.error)
    },
    [uid]
  )

  const updateTrip = useCallback(
    (trip: Trip) => {
      dispatch({ type: 'UPDATE_TRIP', trip })
      if (uid) saveTrip(uid, trip).catch(console.error)
    },
    [uid]
  )

  const deleteTrip = useCallback(
    (id: string) => {
      const expenses = stateRef.current.expenses
      dispatch({ type: 'DELETE_TRIP', id })
      if (uid) removeTrip(uid, id, expenses).catch(console.error)
    },
    [uid]
  )

  const addExpense = useCallback(
    (expense: Expense) => {
      dispatch({ type: 'ADD_EXPENSE', expense })
      if (uid) saveExpense(uid, expense).catch(console.error)
    },
    [uid]
  )

  const updateExpense = useCallback(
    (expense: Expense) => {
      dispatch({ type: 'UPDATE_EXPENSE', expense })
      if (uid) saveExpense(uid, expense).catch(console.error)
    },
    [uid]
  )

  const deleteExpense = useCallback(
    (id: string) => {
      dispatch({ type: 'DELETE_EXPENSE', id })
      if (uid) removeExpense(uid, id).catch(console.error)
    },
    [uid]
  )

  const addMember = useCallback(
    (tripId: string, member: Member) => {
      dispatch({ type: 'ADD_MEMBER', tripId, member })
      if (uid) {
        const trip = stateRef.current.trips.find((t) => t.id === tripId)
        if (trip) saveTrip(uid, { ...trip, members: [...trip.members, member] }).catch(console.error)
      }
    },
    [uid]
  )

  const removeMember = useCallback(
    (tripId: string, memberId: string) => {
      dispatch({ type: 'REMOVE_MEMBER', tripId, memberId })
      if (uid) {
        const trip = stateRef.current.trips.find((t) => t.id === tripId)
        if (trip) {
          saveTrip(uid, { ...trip, members: trip.members.filter((m) => m.id !== memberId) }).catch(
            console.error
          )
        }
      }
    },
    [uid]
  )

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
