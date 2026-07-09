import { useState } from 'react'
import type { Trip, Expense } from '../types'
import { formatINR } from '../utils/format'
import { computeBalances, minimizeSettlements } from '../utils/settlement'
import { getCategoryConfig, CATEGORIES } from './CategoryConfig'
import { buildShareText, shareOrCopy } from '../utils/share'

interface Props {
  trip: Trip
  expenses: Expense[]
  onClose: () => void
}

export default function ShareModal({ trip, expenses, onClose }: Props) {
  const [feedback, setFeedback] = useState<'shared' | 'copied' | null>(null)
  const [loading, setLoading] = useState(false)

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPct = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0
  const remaining = trip.budget - totalSpent
  const isOver = remaining < 0

  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  const catTotals: Record<string, { emoji: string; label: string; amount: number }> = {}
  for (const exp of expenses) {
    const cfg = getCategoryConfig(exp.category)
    const key = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : exp.category
    const label = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : cfg.label
    if (!catTotals[key]) catTotals[key] = { emoji: cfg.emoji, label, amount: 0 }
    catTotals[key].amount += exp.amount
  }

  const standardOrder = CATEGORIES.map((c) => c.id)
  const sortedCats = Object.entries(catTotals)
    .filter(([, v]) => v.amount > 0)
    .sort(([a], [b]) => {
      const ai = standardOrder.indexOf(a as never)
      const bi = standardOrder.indexOf(b as never)
      if (ai === -1 && bi === -1) return catTotals[b].amount - catTotals[a].amount
      if (ai === -1) return 1
      if (bi === -1) return -1
      return catTotals[b].amount - catTotals[a].amount
    })

  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)

  async function handleShare() {
    setLoading(true)
    try {
      const text = buildShareText(trip, expenses)
      const result = await shareOrCopy(trip.name, text)
      setFeedback(result)
      if (result === 'shared') setTimeout(onClose, 500)
    } catch {
      // user dismissed the share sheet — not an error
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    setLoading(true)
    try {
      const text = buildShareText(trip, expenses)
      await navigator.clipboard.writeText(text)
      setFeedback('copied')
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback('copied') // optimistic on older browsers
    } finally {
      setLoading(false)
    }
  }

  const barColor = isOver ? 'bg-[var(--red)]' : budgetPct > 80 ? 'bg-[var(--orange)]' : 'bg-[var(--action)]'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-[var(--bg)] rounded-t-[18px] border-t border-[var(--hairline)] max-h-[90dvh] overflow-y-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-[var(--disabled)] rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.2px' }}>
              Trip Summary
            </h2>
            <button onClick={onClose} className="text-[var(--muted)] text-sm">Close</button>
          </div>

          {/* Card preview */}
          <div className="bg-[var(--surface)] rounded-[18px] border border-[var(--hairline)] p-4 mb-4">
            {/* Header */}
            <div className="flex items-start gap-2 mb-4">
              <span className="text-2xl">✈️</span>
              <div>
                <div className="font-semibold text-[var(--ink)] text-base" style={{ letterSpacing: '-0.2px' }}>{trip.name}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{trip.destination}</div>
              </div>
            </div>

            {/* Budget */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-2xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.5px' }}>
                  {formatINR(totalSpent)}
                </span>
                {trip.budget > 0 && (
                  <span className="text-xs text-[var(--muted)]">of {formatINR(trip.budget)}</span>
                )}
              </div>
              {trip.budget > 0 && (
                <>
                  <div className="bg-[var(--divider)] rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--muted)]">{Math.round(budgetPct)}% used</span>
                    <span className={`text-[10px] font-medium ${isOver ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                      {isOver ? `${formatINR(Math.abs(remaining))} over` : `${formatINR(remaining)} left`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Categories */}
            {sortedCats.length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">By Category</div>
                <div className="space-y-1.5">
                  {sortedCats.map(([key, { emoji, label, amount }]) => {
                    const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-base w-5 text-center">{emoji}</span>
                        <span className="text-xs text-[var(--ink)] flex-1">{label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[var(--divider)] rounded-full h-1 overflow-hidden">
                            <div className="h-1 rounded-full bg-[var(--action)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-[var(--ink)] w-20 text-right">{formatINR(amount)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Settlements */}
            {settlements.length > 0 ? (
              <div>
                <div className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Who Pays Whom</div>
                <div className="space-y-1.5">
                  {settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[var(--red)] font-medium">{memberName(s.from)}</span>
                        <span className="text-[var(--muted)] mx-1.5">→</span>
                        <span className="text-[var(--green)] font-medium">{memberName(s.to)}</span>
                      </div>
                      <span className="text-[var(--ink)] font-semibold">{formatINR(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : expenses.length > 0 && trip.members.length > 1 ? (
              <div className="flex items-center gap-2 bg-[var(--green-tint)] rounded-[11px] px-3 py-2">
                <span>✅</span>
                <span className="text-xs text-[var(--green)] font-medium">All settled up!</span>
              </div>
            ) : null}

            <div className="mt-4 pt-3 border-t border-[var(--divider)] text-[10px] text-[var(--disabled)] text-center">
              Tracked with TripTracker
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="text-center text-sm text-[var(--green)] font-medium mb-3">
              {feedback === 'copied' ? '✓ Copied to clipboard!' : '✓ Shared!'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            {typeof navigator.share === 'function' && (
              <button
                onClick={handleShare}
                disabled={loading}
                className="flex-1 py-3.5 rounded-full bg-[var(--action)] text-white font-medium text-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                📤 Share
              </button>
            )}
            <button
              onClick={handleCopy}
              disabled={loading}
              className="flex-1 py-3.5 rounded-full border border-[var(--action)] text-[var(--action)] font-medium text-sm disabled:opacity-50 active:scale-95 transition-transform"
            >
              {feedback === 'copied' ? '✓ Copied!' : 'Copy Text'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
