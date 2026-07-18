import { describe, it, expect } from 'vitest'
import { computeBalances, computeRawDebts, minimizeSettlements, countMemberExpenses, memberHasUnpaidBalance } from './settlement'
import type { Expense, Member } from '../types'

const members: Member[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
]

function expense(partial: Partial<Expense>): Expense {
  return {
    id: 'e1',
    tripId: 't1',
    createdByUid: 'u1',
    amount: 0,
    category: 'food',
    paidBy: 'a',
    splitBetween: [],
    date: '2026-01-01',
    notes: '',
    ...partial,
  }
}

describe('computeBalances', () => {
  it('gives everyone a zero balance when there are no expenses', () => {
    const balances = computeBalances([], members)
    expect(balances.get('a')).toBe(0)
    expect(balances.get('b')).toBe(0)
    expect(balances.get('c')).toBe(0)
  })

  it('splits an expense equally among the people it was split between', () => {
    // Alice pays ₹300, split equally between all three
    const balances = computeBalances(
      [expense({ amount: 300, paidBy: 'a', splitBetween: ['a', 'b', 'c'] })],
      members
    )
    expect(balances.get('a')).toBe(200) // paid 300, owes 100 back to self
    expect(balances.get('b')).toBe(-100)
    expect(balances.get('c')).toBe(-100)
  })

  it('respects custom per-person split amounts instead of splitting equally', () => {
    const balances = computeBalances(
      [
        expense({
          amount: 300,
          paidBy: 'a',
          splitBetween: ['a', 'b', 'c'],
          splitAmounts: [
            { memberId: 'a', amount: 100 },
            { memberId: 'b', amount: 150 },
            { memberId: 'c', amount: 50 },
          ],
        }),
      ],
      members
    )
    expect(balances.get('a')).toBe(200) // paid 300, owes 100
    expect(balances.get('b')).toBe(-150)
    expect(balances.get('c')).toBe(-50)
  })

  it('someone not involved in any expense stays at exactly zero', () => {
    const balances = computeBalances(
      [expense({ amount: 100, paidBy: 'a', splitBetween: ['a', 'b'] })],
      members
    )
    expect(balances.get('c')).toBe(0)
  })

  it('an expense with no one to split between is ignored, not divided by zero', () => {
    const balances = computeBalances(
      [expense({ amount: 100, paidBy: 'a', splitBetween: [] })],
      members
    )
    expect(balances.get('a')).toBe(0)
  })

  it('adds up correctly across several expenses', () => {
    const balances = computeBalances(
      [
        expense({ amount: 300, paidBy: 'a', splitBetween: ['a', 'b', 'c'] }), // a:+200 b:-100 c:-100
        expense({ amount: 60, paidBy: 'b', splitBetween: ['a', 'b'] }), // a:-30 b:+30
      ],
      members
    )
    expect(balances.get('a')).toBe(170)
    expect(balances.get('b')).toBe(-70)
    expect(balances.get('c')).toBe(-100)
  })
})

describe('minimizeSettlements', () => {
  it('produces no payments when everyone is already even', () => {
    const balances = new Map([
      ['a', 0],
      ['b', 0],
    ])
    expect(minimizeSettlements(balances)).toEqual([])
  })

  it('one debtor paying one creditor is a single payment', () => {
    const balances = new Map([
      ['a', 100],
      ['b', -100],
    ])
    const settlements = minimizeSettlements(balances)
    expect(settlements).toEqual([{ from: 'b', to: 'a', amount: 100 }])
  })

  it('nets a three-person group down to the fewest possible payments', () => {
    // a is owed 100, b is owed 50, c owes 150 total
    const balances = new Map([
      ['a', 100],
      ['b', 50],
      ['c', -150],
    ])
    const settlements = minimizeSettlements(balances)
    // c alone can cover both a and b — never more than 2 payments for 3 people
    expect(settlements.length).toBeLessThanOrEqual(2)
    const totalPaid = settlements.reduce((s, x) => s + x.amount, 0)
    expect(totalPaid).toBe(150)
  })

  it('rounds fractional balances so nobody is left owing a fraction of a rupee', () => {
    const balances = new Map([
      ['a', 33.333],
      ['b', -33.333],
    ])
    const settlements = minimizeSettlements(balances)
    expect(Number.isInteger(settlements[0].amount)).toBe(true)
  })
})

describe('computeRawDebts', () => {
  it('returns nothing when there are no expenses', () => {
    expect(computeRawDebts([])).toEqual([])
  })

  it('nets out bidirectional debts between the same two people', () => {
    const debts = computeRawDebts([
      // a owes b 100
      expense({ id: 'e1', amount: 100, paidBy: 'b', splitBetween: ['a'] }),
      // b owes a 60
      expense({ id: 'e2', amount: 60, paidBy: 'a', splitBetween: ['b'] }),
    ])
    // net: a still owes b 40
    expect(debts).toEqual([{ from: 'a', to: 'b', amount: 40 }])
  })

  it('drops a pair entirely once their debts fully cancel out', () => {
    const debts = computeRawDebts([
      expense({ id: 'e1', amount: 100, paidBy: 'b', splitBetween: ['a'] }),
      expense({ id: 'e2', amount: 100, paidBy: 'a', splitBetween: ['b'] }),
    ])
    expect(debts).toEqual([])
  })
})

describe('countMemberExpenses', () => {
  it('counts an expense the member paid for', () => {
    const count = countMemberExpenses(
      [expense({ paidBy: 'a', splitBetween: ['b'] })],
      'a'
    )
    expect(count).toBe(1)
  })

  it('counts an expense the member is only part of the split for', () => {
    const count = countMemberExpenses(
      [expense({ paidBy: 'b', splitBetween: ['a', 'b'] })],
      'a'
    )
    expect(count).toBe(1)
  })

  it('counts an expense only once even if the member is both payer and in the split', () => {
    const count = countMemberExpenses(
      [expense({ paidBy: 'a', splitBetween: ['a', 'b'] })],
      'a'
    )
    expect(count).toBe(1)
  })

  it('does not count an expense the member has nothing to do with', () => {
    const count = countMemberExpenses(
      [expense({ paidBy: 'b', splitBetween: ['b', 'c'] })],
      'a'
    )
    expect(count).toBe(0)
  })

  it('is zero for someone with no expenses at all', () => {
    expect(countMemberExpenses([], 'a')).toBe(0)
  })
})

describe('memberHasUnpaidBalance', () => {
  const settlements = [{ from: 'a', to: 'b', amount: 720 }]

  it('is true when the member is part of a settlement nobody has marked paid', () => {
    expect(memberHasUnpaidBalance(settlements, [], 'a')).toBe(true)
    expect(memberHasUnpaidBalance(settlements, [], 'b')).toBe(true)
  })

  // This is the exact bug that was found: after marking "a pays b" as paid,
  // the removal warning still said "a owes ₹720" — contradicting the
  // crossed-out, "✓ Paid" settlement shown right above it.
  it('is false once that settlement has been marked paid', () => {
    const paid = [{ from: 'a', to: 'b', paidAt: '2026-01-01' }]
    expect(memberHasUnpaidBalance(settlements, paid, 'a')).toBe(false)
    expect(memberHasUnpaidBalance(settlements, paid, 'b')).toBe(false)
  })

  it('is false for someone not involved in any settlement at all', () => {
    expect(memberHasUnpaidBalance(settlements, [], 'c')).toBe(false)
  })

  it('marking one settlement paid does not hide a DIFFERENT unpaid one for the same member', () => {
    const twoSettlements = [
      { from: 'a', to: 'b', amount: 720 },
      { from: 'a', to: 'c', amount: 100 },
    ]
    const onlyFirstPaid = [{ from: 'a', to: 'b', paidAt: '2026-01-01' }]
    expect(memberHasUnpaidBalance(twoSettlements, onlyFirstPaid, 'a')).toBe(true)
  })
})
