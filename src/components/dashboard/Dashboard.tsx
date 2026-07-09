import { useState } from 'react'
import type { Expense, Trip } from '../../types'
import { formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements } from '../../utils/settlement'
import ShareModal from '../ShareModal'
import { printTripSummary } from '../../utils/printPDF'

interface Props {
  trip: Trip
  expenses: Expense[]
}

export default function Dashboard({ trip, expenses }: Props) {
  const [showShare, setShowShare] = useState(false)

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPct = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0
  const remaining = trip.budget - totalSpent

  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  const card = 'bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4'

  if (expenses.length === 0) {
    return (
      <div className="p-4 pb-32 space-y-4">
        <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />
        <div className="flex flex-col items-center py-16 text-[var(--muted)]">
          <span className="text-5xl mb-3">📊</span>
          <p className="text-sm">No expenses yet.</p>
          <p className="text-xs mt-1">Add expenses to see your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => printTripSummary(trip, expenses)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] bg-[var(--surface)] border border-[var(--hairline)] px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          📄 PDF
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--action)] bg-[var(--action-tint)] border border-[var(--action-border)] px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          📤 Share
        </button>
      </div>
      <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />

      {/* Per-person spend */}
      {trip.members.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.1px' }}>Spent by Member</p>
          <div className="space-y-3">
            {trip.members.map((member) => {
              const spent = expenses
                .filter((e) => e.paidBy === member.id)
                .reduce((s, e) => s + e.amount, 0)
              const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0
              return (
                <div key={member.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--ink)]">{member.name}</span>
                    <span className="text-sm font-semibold text-[var(--ink)]">{formatINR(spent)}</span>
                  </div>
                  <div className="bg-[var(--divider)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-[var(--action)] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">{pct.toFixed(0)}% of total</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.1px' }}>Quick Settlement</p>
          <div className="space-y-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--red)] font-medium truncate">{memberName(s.from)}</span>
                <span className="text-[var(--muted)] text-xs">→</span>
                <span className="text-[var(--green)] font-medium truncate">{memberName(s.to)}</span>
                <span className="text-[var(--ink)] font-semibold ml-auto">{formatINR(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShare && (
        <ShareModal trip={trip} expenses={expenses} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

function BudgetCard({
  totalSpent, budget, budgetPct, remaining,
}: {
  totalSpent: number; budget: number; budgetPct: number; remaining: number
}) {
  const isOver = remaining < 0
  const isWarning = !isOver && budgetPct > 80
  const barColor = isOver ? 'bg-[var(--red)]' : isWarning ? 'bg-[var(--orange)]' : 'bg-[var(--action)]'
  const remainColor = isOver ? 'text-[var(--red)]' : isWarning ? 'text-[var(--orange)]' : 'text-[var(--green)]'

  return (
    <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-[var(--muted)] mb-0.5">Total Spent</p>
          <p className="text-2xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.5px' }}>{formatINR(totalSpent)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)] mb-0.5">{isOver ? 'Over Budget' : 'Remaining'}</p>
          <p className={`text-2xl font-semibold ${remainColor}`} style={{ letterSpacing: '-0.5px' }}>
            {formatINR(Math.abs(remaining))}
          </p>
        </div>
      </div>
      <div className="bg-[var(--divider)] rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${budgetPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[var(--muted)]">{budgetPct.toFixed(0)}% used</span>
        <span className="text-[10px] text-[var(--muted)]">Budget: {formatINR(budget)}</span>
      </div>
    </div>
  )
}
