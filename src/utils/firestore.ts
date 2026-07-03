import { db } from './firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Trip, Expense, Member } from '../types'

// Firestore rejects undefined values — strip them before writing
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T
}

const tripsCol = collection(db, 'trips')
const tripDoc = (tripId: string) => doc(db, 'trips', tripId)
const expensesCol = (tripId: string) => collection(db, 'trips', tripId, 'expenses')

// memberUids is always derived — never edited directly. It drives the
// "my trips" query and the security rules' membership checks.
export function memberUidsFor(trip: Pick<Trip, 'ownerUid' | 'members'>): string[] {
  const uids = new Set<string>([trip.ownerUid])
  for (const m of trip.members) if (m.uid) uids.add(m.uid)
  return [...uids]
}

function cleanTrip(trip: Trip): Trip {
  return clean({
    ...trip,
    members: trip.members.map((m) => clean(m)),
    memberUids: memberUidsFor(trip),
  })
}

// ─── Realtime subscriptions ─────────────────────────────────────────────────

export function subscribeTrips(uid: string, cb: (trips: Trip[]) => void): Unsubscribe {
  const q = query(tripsCol, where('memberUids', 'array-contains', uid))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Trip)),
    (err) => console.error('trips listener error', err)
  )
}

export function subscribeExpenses(tripId: string, cb: (expenses: Expense[]) => void): Unsubscribe {
  return onSnapshot(
    expensesCol(tripId),
    (snap) => cb(snap.docs.map((d) => d.data() as Expense)),
    (err) => console.error('expenses listener error', err)
  )
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function saveTrip(trip: Trip): Promise<void> {
  await setDoc(tripDoc(trip.id), cleanTrip(trip))
}

export async function removeTrip(tripId: string): Promise<void> {
  const expSnap = await getDocs(expensesCol(tripId))
  const batch = writeBatch(db)
  expSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(tripDoc(tripId))
  await batch.commit()
}

export async function saveExpense(tripId: string, expense: Expense): Promise<void> {
  await setDoc(doc(expensesCol(tripId), expense.id), clean(expense))
}

export async function removeExpense(tripId: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(expensesCol(tripId), expenseId))
}

// ─── Join flow ──────────────────────────────────────────────────────────────

// Pre-join preview: any signed-in holder of the trip id may read the trip doc
// (see firestore.rules `allow get`). Returns null for missing/denied.
export async function getTripForJoin(tripId: string): Promise<Trip | null> {
  try {
    const snap = await getDoc(tripDoc(tripId))
    return snap.exists() ? (snap.data() as Trip) : null
  } catch {
    return null
  }
}

export interface JoiningUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

// One update that satisfies the non-member join rule: every existing
// memberUid preserved (arrayUnion), own uid added, members list not shrunk.
// claimMemberId links the account to an existing offline member; otherwise
// a new member entry is appended.
export async function joinTrip(
  tripId: string,
  user: JoiningUser,
  trip: Trip,
  claimMemberId?: string
): Promise<void> {
  const accountFields = clean({
    uid: user.uid,
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
  })

  let members: Member[]
  if (claimMemberId) {
    members = trip.members.map((m) =>
      m.id === claimMemberId ? clean({ ...m, ...accountFields }) : clean(m)
    )
  } else {
    members = [
      ...trip.members.map((m) => clean(m)),
      clean({
        id: crypto.randomUUID(),
        name: user.displayName || user.email || 'New member',
        ...accountFields,
      }),
    ]
  }

  await updateDoc(tripDoc(tripId), {
    memberUids: arrayUnion(user.uid),
    members,
  })
}

// ─── One-time migration from legacy /users/{uid}/… layout ───────────────────

// Copy-then-delete: old docs are only removed after every copy is confirmed,
// so a crash mid-migration just re-runs idempotently on next login.
export async function migrateLegacyData(uid: string): Promise<void> {
  const oldTripsSnap = await getDocs(collection(db, 'users', uid, 'trips'))
  if (oldTripsSnap.empty) return

  const oldExpensesSnap = await getDocs(collection(db, 'users', uid, 'expenses'))
  const expensesByTrip = new Map<string, Expense[]>()
  for (const d of oldExpensesSnap.docs) {
    const exp = d.data() as Expense
    const list = expensesByTrip.get(exp.tripId) ?? []
    list.push(exp)
    expensesByTrip.set(exp.tripId, list)
  }

  // Copy each trip + its expenses into the shared layout
  for (const t of oldTripsSnap.docs) {
    const legacy = t.data() as Trip
    const trip: Trip = {
      ...legacy,
      members: legacy.members ?? [],
      ownerUid: uid,
      memberUids: [uid],
    }
    const expenses = expensesByTrip.get(trip.id) ?? []

    // Firestore batches cap at 500 ops — chunk trip doc + expenses
    const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [
      (b) => b.set(tripDoc(trip.id), cleanTrip(trip)),
      ...expenses.map(
        (e) => (b: ReturnType<typeof writeBatch>) =>
          b.set(doc(expensesCol(trip.id), e.id), clean({ ...e, createdByUid: uid }))
      ),
    ]
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db)
      ops.slice(i, i + 400).forEach((op) => op(batch))
      await batch.commit()
    }
  }

  // All copies confirmed — now delete the legacy docs
  const oldDocs = [...oldTripsSnap.docs, ...oldExpensesSnap.docs]
  for (let i = 0; i < oldDocs.length; i += 400) {
    const batch = writeBatch(db)
    oldDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}
