import type { Trip, Expense } from '../types'
import { formatINR } from './format'
import { computeBalances, minimizeSettlements } from './settlement'
import { getCategoryConfig, CATEGORIES } from '../components/CategoryConfig'

export function buildShareText(trip: Trip, expenses: Expense[]): string {
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPct = trip.budget > 0 ? Math.round((totalSpent / trip.budget) * 100) : 0

  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  // Category totals — exclude 'custom' bucket, fold custom expenses into their own label
  const catTotals: Record<string, { emoji: string; label: string; amount: number }> = {}
  for (const exp of expenses) {
    const cfg = getCategoryConfig(exp.category)
    const key = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : exp.category
    const label = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : cfg.label
    const emoji = cfg.emoji
    if (!catTotals[key]) catTotals[key] = { emoji, label, amount: 0 }
    catTotals[key].amount += exp.amount
  }

  // Sort all standard categories by spend, then custom ones
  const standardOrder = CATEGORIES.map((c) => c.id)
  const sortedCats = Object.entries(catTotals)
    .filter(([, v]) => v.amount > 0)
    .sort(([a], [b]) => {
      const ai = standardOrder.indexOf(a as never)
      const bi = standardOrder.indexOf(b as never)
      if (ai === -1 && bi === -1) return b[1] < a[1] ? -1 : 1
      if (ai === -1) return 1
      if (bi === -1) return -1
      return catTotals[b].amount - catTotals[a].amount
    })

  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)

  const lines: string[] = []
  lines.push(`✈️ ${trip.name} · ${trip.destination}`)
  lines.push('━━━━━━━━━━━━━━━━')
  if (trip.budget > 0) {
    lines.push(`💰 Total: ${formatINR(totalSpent)} of ${formatINR(trip.budget)} (${budgetPct}% used)`)
  } else {
    lines.push(`💰 Total Spent: ${formatINR(totalSpent)}`)
  }

  if (sortedCats.length > 0) {
    lines.push('')
    lines.push('📋 By Category')
    for (const [, { emoji, label, amount }] of sortedCats) {
      lines.push(`${emoji} ${label} · ${formatINR(amount)}`)
    }
  }

  if (settlements.length > 0) {
    lines.push('')
    lines.push('👥 Who Pays Whom')
    for (const s of settlements) {
      lines.push(`• ${memberName(s.from)} → ${memberName(s.to)} · ${formatINR(s.amount)}`)
    }
  } else if (expenses.length > 0 && trip.members.length > 1) {
    lines.push('')
    lines.push('👥 All settled up! ✅')
  }

  lines.push('')
  lines.push('Tracked with TripTracker')

  return lines.join('\n')
}

export async function shareOrCopy(title: string, text: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text })
    return 'shared'
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
