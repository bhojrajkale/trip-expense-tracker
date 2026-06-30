import type { Expense, Member, Settlement } from '../types'

export function computeBalances(
  expenses: Expense[],
  members: Member[]
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const m of members) balances.set(m.id, 0)

  for (const exp of expenses) {
    const splitCount = exp.splitBetween.length
    if (splitCount === 0) continue

    if (exp.splitAmounts && exp.splitAmounts.length > 0) {
      // custom split
      const paidBalance = balances.get(exp.paidBy) ?? 0
      balances.set(exp.paidBy, paidBalance + exp.amount)
      for (const sa of exp.splitAmounts) {
        const b = balances.get(sa.memberId) ?? 0
        balances.set(sa.memberId, b - sa.amount)
      }
    } else {
      // equal split
      const perPerson = exp.amount / splitCount
      const paidBalance = balances.get(exp.paidBy) ?? 0
      balances.set(exp.paidBy, paidBalance + exp.amount)
      for (const memberId of exp.splitBetween) {
        const b = balances.get(memberId) ?? 0
        balances.set(memberId, b - perPerson)
      }
    }
  }

  return balances
}

// Computes pairwise debts per expense without minimization across the group.
// Returns netted direct debts: if A owes B ₹100 and B owes A ₹60, result is A owes B ₹40.
export function computeRawDebts(expenses: Expense[]): Settlement[] {
  // pairwise[from][to] = amount owed
  const pairwise: Record<string, Record<string, number>> = {}

  const add = (from: string, to: string, amt: number) => {
    if (from === to || amt <= 0) return
    if (!pairwise[from]) pairwise[from] = {}
    pairwise[from][to] = (pairwise[from][to] ?? 0) + amt
  }

  for (const exp of expenses) {
    if (exp.splitBetween.length === 0) continue

    if (exp.splitAmounts && exp.splitAmounts.length > 0) {
      for (const sa of exp.splitAmounts) {
        add(sa.memberId, exp.paidBy, sa.amount)
      }
    } else {
      const perPerson = exp.amount / exp.splitBetween.length
      for (const memberId of exp.splitBetween) {
        add(memberId, exp.paidBy, perPerson)
      }
    }
  }

  // Net out bidirectional debts between each pair
  const settled = new Set<string>()
  const results: Settlement[] = []

  for (const from of Object.keys(pairwise)) {
    for (const to of Object.keys(pairwise[from])) {
      const key = [from, to].sort().join('|')
      if (settled.has(key)) continue
      settled.add(key)

      const fOwesT = pairwise[from]?.[to] ?? 0
      const tOwesF = pairwise[to]?.[from] ?? 0
      const net = Math.round(fOwesT - tOwesF)

      if (net > 0) results.push({ from, to, amount: net })
      else if (net < 0) results.push({ from: to, to: from, amount: -net })
    }
  }

  return results.filter((s) => s.amount > 0)
}

export function minimizeSettlements(
  balances: Map<string, number>
): Settlement[] {
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [id, bal] of balances.entries()) {
    const rounded = Math.round(bal)
    if (rounded > 0) creditors.push({ id, amount: rounded })
    else if (rounded < 0) debtors.push({ id, amount: -rounded })
  }

  const settlements: Settlement[] = []

  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    const amt = Math.min(credit.amount, debt.amount)
    settlements.push({ from: debt.id, to: credit.id, amount: amt })
    credit.amount -= amt
    debt.amount -= amt
    if (credit.amount === 0) ci++
    if (debt.amount === 0) di++
  }

  return settlements
}
