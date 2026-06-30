import type { Trip, Expense } from '../types'

const TRIPS_KEY = 'tet_trips'
const EXPENSES_KEY = 'tet_expenses'
const ACTIVE_TRIP_KEY = 'tet_active_trip'

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY)
    return raw ? (JSON.parse(raw) as Trip[]) : []
  } catch {
    return []
  }
}

export function saveTrips(trips: Trip[]): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips))
}

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY)
    return raw ? (JSON.parse(raw) as Expense[]) : []
  } catch {
    return []
  }
}

export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
}

export function loadActiveTripId(): string | null {
  return localStorage.getItem(ACTIVE_TRIP_KEY)
}

export function saveActiveTripId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_TRIP_KEY, id)
  else localStorage.removeItem(ACTIVE_TRIP_KEY)
}
