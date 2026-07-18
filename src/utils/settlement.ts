import type { Expense, Member, PaidSettlement, Settlement, SplitAmount } from '../types'

// How many expenses a member is tied to (as payer or in the split) — used to
// warn before removing them. Removing a member never touches expenses; their
// id stays on old records but no longer resolves to a name anywhere, so this
// lets the UI tell the owner what they'd be making anonymous before they do it.
export function countMemberExpenses(expenses: Expense[], memberId: string): number {
  return expenses.filter((e) => e.paidBy === memberId || e.splitBetween.includes(memberId)).length
}

// Converts a percentage-per-member split into the absolute per-rupee amounts
// the app actually stores (SplitAmount — percentages themselves are never
// persisted, just a convenience input mode). Each member's share is rounded
// to the nearest rupee, and whatever rounding remainder is left over is
// folded into the LAST member in memberIds order — this guarantees the
// split always sums to exactly the expense total, never off by a rupee,
// rather than each person's amount silently drifting from their percentage.
export function splitByPercentage(
  amount: number,
  memberIds: string[],
  percents: Record<string, number>
): SplitAmount[] {
  if (memberIds.length === 0) return []
  // Defensive clamp: a percentage outside [0, 100] (e.g. a caller passing
  // through an un-validated -20/120 pair that still sums to 100) would
  // otherwise produce a negative SplitAmount — computeBalances trusts these
  // as ground truth, so a negative share becomes a phantom credit. The form
  // also validates this before calling in, but this function shouldn't rely
  // on that being true forever.
  const entries: SplitAmount[] = memberIds.map((memberId) => ({
    memberId,
    amount: Math.round((amount * Math.min(100, Math.max(0, percents[memberId] ?? 0))) / 100),
  }))
  const allocated = entries.reduce((s, e) => s + e.amount, 0)
  entries[entries.length - 1].amount += Math.round(amount) - allocated
  return entries
}

// A member's raw balance (from computeBalances) is pure expense math — it has
// no idea a settlement was manually marked "✓ Paid" (trip.paidSettlements is
// a separate acknowledgment layer, not part of the money math). This tells
// you whether this member actually still has something outstanding, so UI
// text mentioning a balance doesn't contradict a settlement already shown
// crossed-out elsewhere on the same screen.
export function memberHasUnpaidBalance(
  settlements: Settlement[],
  paidSettlements: PaidSettlement[],
  memberId: string
): boolean {
  return settlements.some(
    (s) =>
      (s.from === memberId || s.to === memberId) &&
      !paidSettlements.some((p) => p.from === s.from && p.to === s.to)
  )
}

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
