import { useReducer, useEffect, useCallback } from 'react'
import type { Trip, Expense, Member } from '../types'
import {
  loadTrips,
  saveTrips,
  loadExpenses,
  saveExpenses,
  loadActiveTripId,
  saveActiveTripId,
} from '../utils/storage'

interface State {
  trips: Trip[]
  expenses: Expense[]
  activeTripId: string | null
}

type Action =
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
    case 'SET_ACTIVE_TRIP':
      return { ...state, activeTripId: action.id }
    case 'ADD_TRIP':
      return { ...state, trips: [...state.trips, action.trip] }
    case 'UPDATE_TRIP':
      return {
        ...state,
        trips: state.trips.map((t) => (t.id === action.trip.id ? action.trip : t)),
      }
    case 'DELETE_TRIP': {
      const trips = state.trips.filter((t) => t.id !== action.id)
      const expenses = state.expenses.filter((e) => e.tripId !== action.id)
      const activeTripId =
        state.activeTripId === action.id
          ? (trips[0]?.id ?? null)
          : state.activeTripId
      return { trips, expenses, activeTripId }
    }
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.expense] }
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expense.id ? action.expense : e
        ),
      }
    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      }
    case 'ADD_MEMBER':
      return {
        ...state,
        trips: state.trips.map((t) =>
          t.id === action.tripId
            ? { ...t, members: [...t.members, action.member] }
            : t
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

function initState(): State {
  const trips = loadTrips()
  const expenses = loadExpenses()
  const savedId = loadActiveTripId()
  const activeTripId =
    trips.find((t) => t.id === savedId)?.id ?? trips[0]?.id ?? null
  return { trips, expenses, activeTripId }
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  useEffect(() => {
    saveTrips(state.trips)
  }, [state.trips])

  useEffect(() => {
    saveExpenses(state.expenses)
  }, [state.expenses])

  useEffect(() => {
    saveActiveTripId(state.activeTripId)
  }, [state.activeTripId])

  const activeTrip = state.trips.find((t) => t.id === state.activeTripId) ?? null
  const activeExpenses = state.expenses.filter(
    (e) => e.tripId === state.activeTripId
  )

  const setActiveTrip = useCallback(
    (id: string | null) => dispatch({ type: 'SET_ACTIVE_TRIP', id }),
    []
  )
  const addTrip = useCallback(
    (trip: Trip) => dispatch({ type: 'ADD_TRIP', trip }),
    []
  )
  const updateTrip = useCallback(
    (trip: Trip) => dispatch({ type: 'UPDATE_TRIP', trip }),
    []
  )
  const deleteTrip = useCallback(
    (id: string) => dispatch({ type: 'DELETE_TRIP', id }),
    []
  )
  const addExpense = useCallback(
    (expense: Expense) => dispatch({ type: 'ADD_EXPENSE', expense }),
    []
  )
  const updateExpense = useCallback(
    (expense: Expense) => dispatch({ type: 'UPDATE_EXPENSE', expense }),
    []
  )
  const deleteExpense = useCallback(
    (id: string) => dispatch({ type: 'DELETE_EXPENSE', id }),
    []
  )
  const addMember = useCallback(
    (tripId: string, member: Member) =>
      dispatch({ type: 'ADD_MEMBER', tripId, member }),
    []
  )
  const removeMember = useCallback(
    (tripId: string, memberId: string) =>
      dispatch({ type: 'REMOVE_MEMBER', tripId, memberId }),
    []
  )

  return {
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
