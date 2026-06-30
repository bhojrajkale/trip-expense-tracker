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
}

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate?: string
  budget: number
  members: Member[]
}

export interface SplitAmount {
  memberId: string
  amount: number
}

export interface Expense {
  id: string
  tripId: string
  amount: number
  category: Category
  customCategory?: string
  paidBy: string
  splitBetween: string[]
  splitAmounts?: SplitAmount[]
  date: string
  notes: string
}

export type Tab = 'dashboard' | 'add' | 'expenses' | 'people'

export interface Settlement {
  from: string
  to: string
  amount: number
}
