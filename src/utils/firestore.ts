import { db } from './firebase'
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore'
import type { Trip, Expense } from '../types'

// Firestore rejects undefined values — strip them before writing
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T
}

const tripsCol = (uid: string) => collection(db, 'users', uid, 'trips')
const expensesCol = (uid: string) => collection(db, 'users', uid, 'expenses')

export async function loadTrips(uid: string): Promise<Trip[]> {
  const snap = await getDocs(tripsCol(uid))
  return snap.docs.map((d) => d.data() as Trip)
}

export async function saveTrip(uid: string, trip: Trip): Promise<void> {
  await setDoc(doc(tripsCol(uid), trip.id), clean(trip))
}

export async function removeTrip(uid: string, tripId: string, allExpenses: Expense[]): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(tripsCol(uid), tripId))
  allExpenses
    .filter((e) => e.tripId === tripId)
    .forEach((e) => batch.delete(doc(expensesCol(uid), e.id)))
  await batch.commit()
}

export async function loadExpenses(uid: string): Promise<Expense[]> {
  const snap = await getDocs(expensesCol(uid))
  return snap.docs.map((d) => d.data() as Expense)
}

export async function saveExpense(uid: string, expense: Expense): Promise<void> {
  await setDoc(doc(expensesCol(uid), expense.id), clean(expense))
}

export async function removeExpense(uid: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(expensesCol(uid), expenseId))
}
