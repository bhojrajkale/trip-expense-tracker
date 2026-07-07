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

export type Tab = 'dashboard' | 'add' | 'expenses' | 'people'

export interface Settlement {
  from: string
  to: string
  amount: number
}
