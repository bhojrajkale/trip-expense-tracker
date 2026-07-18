import type { Trip } from '../types'

// Trip/Expense writes are full-document overwrites (see saveTrip in
// firestore.ts) — any field missing from the saved object is permanently
// deleted. The trip-edit form only owns a handful of fields (name,
// destination, startDate, budget), so applying its output on its own would
// silently wipe everything else (archived, paidSettlements, endDate, …).
// Always spread the existing trip first and layer only the edited fields on
// top. This exact bug happened once — this function exists so it can't
// happen again silently.
export function mergeTripEdit(existing: Trip, edits: Omit<Trip, 'ownerUid' | 'memberUids'>): Trip {
  return { ...existing, ...edits }
}
