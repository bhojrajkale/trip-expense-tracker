export type Category =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'activities'
  | 'shopping'
  | 'custom'

export interface Member {
  id: string
  name: string
  phone?: string
  // Set when a Google account has claimed this member (joined via invite link).
  // Members without a uid are "offline" members — split participants only.
  uid?: string
  email?: string
  photoURL?: string
}

export interface PaidSettlement {
  from: string   // member id
  to: string     // member id
  paidAt: string // ISO date string
}

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate?: string
  budget: number
  members: Member[]
  ownerUid: string
  // Always derived: unique([ownerUid, ...members with uid]). Drives the
  // "my trips" query and Firestore security rules.
  memberUids: string[]
  paidSettlements?: PaidSettlement[]
  archived?: boolean
}

export interface SplitAmount {
  memberId: string
  amount: number
}

export interface Expense {
  id: string
  tripId: string
  // Account that entered this expense (not necessarily who paid).
  // Rules allow edit/delete only by the creator or the trip owner.
  createdByUid: string
  amount: number
  category: Category
  customCategory?: string
  paidBy: string
  splitBetween: string[]
  splitAmounts?: SplitAmount[]
  date: string
  notes: string
  receiptPhotoUrl?: string
}

export type Tab = 'dashboard' | 'add' | 'expenses' | 'people' | 'activity'

export type ActivityType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'member_added'
  | 'member_removed'
  | 'member_joined'
  | 'member_renamed'
  | 'settlement_paid'
  | 'settlement_unpaid'
  | 'trip_updated'

// Append-only event log per trip (trips/{id}/activity). actorName is
// denormalized at write time so entries survive member removal.
export interface Activity {
  id: string
  type: ActivityType
  actorUid: string
  actorName: string
  at: string // ISO timestamp
  amount?: number
  category?: Category
  customCategory?: string
  memberName?: string // member_added / member_removed / member_joined
  fromName?: string   // settlement pair, or old name for member_renamed
  toName?: string      // settlement pair, or new name for member_renamed
}

// Safe subset of Trip exposed pre-join (no email/photoURL/phone/budget) —
// powers the invite preview so opening a link never leaks member PII.
// See buildPreview() in firestore.ts.
export interface TripPreview {
  id: string
  name: string
  destination: string
  startDate: string
  memberUids: string[]
  members: { id: string; name: string; uid?: string }[]
}

// A pending request to join a trip, awaiting owner approval. Lives at
// trips/{tripId}/joinRequests/{uid} — keyed by requester uid (one per user).
export interface JoinRequest {
  uid: string
  name: string
  email: string | null
  photoURL: string | null
  claimMemberId?: string // if they picked an existing offline member to claim
  requestedAt: string    // ISO timestamp
}

export interface Settlement {
  from: string
  to: string
  amount: number
}
