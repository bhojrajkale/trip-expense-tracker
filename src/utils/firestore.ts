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
  orderBy,
  limit,
  writeBatch,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Trip, Expense, Member, Activity, TripPreview } from '../types'

// Firestore rejects undefined values — strip them before writing
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T
}

const tripsCol = collection(db, 'trips')
const tripDoc = (tripId: string) => doc(db, 'trips', tripId)
const previewDoc = (tripId: string) => doc(db, 'tripsPreview', tripId)
const expensesCol = (tripId: string) => collection(db, 'trips', tripId, 'expenses')
const activityCol = (tripId: string) => collection(db, 'trips', tripId, 'activity')

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

// Safe projection for the pre-join preview — deliberately omits email,
// photoURL, phone, and budget. See TripPreview in types.ts.
function buildPreview(trip: Trip): TripPreview {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    memberUids: trip.memberUids,
    members: trip.members.map((m) => clean({ id: m.id, name: m.name, uid: m.uid })),
  }
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

// Newest first, capped — the feed is a recent-changes view, not a full audit log
export function subscribeActivity(tripId: string, cb: (activity: Activity[]) => void): Unsubscribe {
  const q = query(activityCol(tripId), orderBy('at', 'desc'), limit(50))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Activity)),
    (err) => console.error('activity listener error', err)
  )
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function saveTrip(trip: Trip): Promise<void> {
  await setDoc(tripDoc(trip.id), cleanTrip(trip))
  // Sequential, not batched: the preview's write rule checks the trip's
  // just-committed memberUids, so it must run strictly after the real
  // write lands. Also doubles as self-healing backfill for trips that
  // predate this collection.
  await setDoc(previewDoc(trip.id), buildPreview(trip))
}

export async function logActivity(tripId: string, activity: Activity): Promise<void> {
  await setDoc(doc(activityCol(tripId), activity.id), clean(activity))
}

export async function removeTrip(tripId: string): Promise<void> {
  const [expSnap, actSnap] = await Promise.all([
    getDocs(expensesCol(tripId)),
    getDocs(activityCol(tripId)),
  ])
  const batch = writeBatch(db)
  expSnap.docs.forEach((d) => batch.delete(d.ref))
  actSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(previewDoc(tripId))
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

// Safe pre-join read: only name/destination/dates/member names+ids, no PII.
// Any allowlisted signed-in user with the trip id may read this (see
// firestore.rules `tripsPreview`). Returns null for missing/denied.
export async function getTripPreview(tripId: string): Promise<TripPreview | null> {
  try {
    const snap = await getDoc(previewDoc(tripId))
    return snap.exists() ? (snap.data() as TripPreview) : null
  } catch {
    return null
  }
}

// Exposes full member PII (email/photoURL) — only call this right before a
// claim-join write, never on page load. See getTripPreview() for the safe
// pre-join read used everywhere else.
export async function getTripForClaim(tripId: string): Promise<Trip | null> {
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

async function logJoin(tripId: string, uid: string, joinedName: string): Promise<void> {
  logActivity(tripId, {
    id: crypto.randomUUID(),
    type: 'member_joined',
    actorUid: uid,
    actorName: joinedName,
    at: new Date().toISOString(),
    memberName: joinedName,
  }).catch(console.error)
}

// Join as a brand-new member. Pure blind append — needs no read of the trip
// at all, so this path never touches other members' PII.
export async function joinAsNewMember(tripId: string, user: JoiningUser): Promise<void> {
  const newMember = clean({
    id: crypto.randomUUID(),
    name: user.displayName || user.email || 'New member',
    uid: user.uid,
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
  })

  await updateDoc(tripDoc(tripId), {
    memberUids: arrayUnion(user.uid),
    members: arrayUnion(newMember),
  })

  await logJoin(tripId, user.uid, newMember.name)
}

// Claim an existing "offline" member entry as your own account. Replacing
// one array element in place isn't expressible via arrayUnion/arrayRemove
// alone, so this needs the full, current trip (fetched via getTripForClaim
// immediately before this call) to safely preserve every other member's
// data while rewriting the array.
export async function claimMember(
  tripId: string,
  user: JoiningUser,
  fullTrip: Trip,
  claimMemberId: string
): Promise<void> {
  const accountFields = clean({
    uid: user.uid,
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
  })

  const members: Member[] = fullTrip.members.map((m) =>
    m.id === claimMemberId ? clean({ ...m, ...accountFields }) : clean(m)
  )

  await updateDoc(tripDoc(tripId), {
    memberUids: arrayUnion(user.uid),
    members,
  })

  const joinedName = fullTrip.members.find((m) => m.id === claimMemberId)?.name
    ?? user.displayName ?? 'New member'
  await logJoin(tripId, user.uid, joinedName)
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
