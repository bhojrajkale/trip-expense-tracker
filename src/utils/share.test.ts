import { describe, it, expect } from 'vitest'
import { buildShareText } from './share'
import type { Trip, Expense } from '../types'

function trip(partial: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Goa Trip',
    destination: 'Goa',
    startDate: '2026-01-01',
    budget: 1000,
    members: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ],
    ownerUid: 'u1',
    memberUids: ['u1'],
    ...partial,
  }
}

function expense(partial: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    tripId: 't1',
    createdByUid: 'u1',
    amount: 500,
    category: 'food',
    paidBy: 'a',
    splitBetween: ['a', 'b'],
    date: '2026-01-01',
    notes: '',
    ...partial,
  }
}

describe('buildShareText', () => {
  it('includes the trip name and destination', () => {
    const text = buildShareText(trip(), [])
    expect(text).toContain('Goa Trip')
    expect(text).toContain('Goa')
  })

  it('mentions who pays whom when someone owes money', () => {
    const text = buildShareText(trip(), [expense()])
    // Alice paid, so Bob owes Alice
    expect(text).toContain('Bob')
    expect(text).toContain('Alice')
    expect(text).toMatch(/who pays whom/i)
  })

  it('says everyone is settled up when there is nothing left to pay', () => {
    // A single expense split with only one person on it never creates a debt
    const text = buildShareText(trip(), [expense({ splitBetween: ['a'] })])
    expect(text).toMatch(/settled up/i)
  })

  it('does not crash and shows a zero total when there are no expenses at all', () => {
    const text = buildShareText(trip(), [])
    expect(text).toContain('₹0')
  })
})
