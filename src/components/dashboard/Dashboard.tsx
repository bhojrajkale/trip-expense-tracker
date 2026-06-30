import type { Expense, Trip } from '../../types'
import { formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements } from '../../utils/settlement'

interface Props {
  trip: Trip
  expenses: Expense[]
}

export default function Dashboard({ trip, expenses }: Props) {
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPct = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0
  const remaining = trip.budget - totalSpent

  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  if (expenses.length === 0) {
    return (
      <div className="p-4 pb-32 space-y-4">
        <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />
        <div className="flex flex-col items-center py-16 text-slate-500">
          <span className="text-5xl mb-3">📊</span>
          <p className="text-sm">No expenses yet.</p>
          <p className="text-xs mt-1">Add expenses to see your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 space-y-4">
      <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />



      {/* Per-person spend */}
      {trip.members.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-sm font-semibold text-white mb-3">Spent by Member</p>
          <div className="space-y-3">
            {trip.members.map((member) => {
              const spent = expenses
                .filter((e) => e.paidBy === member.id)
                .reduce((s, e) => s + e.amount, 0)
              const pct = totalSpent > 0 ? (spent / totalSpent) * 100 : 0
              return (
                <div key={member.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{member.name}</span>
                    <span className="text-sm font-semibold text-white">{formatINR(spent)}</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{pct.toFixed(0)}% of total</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-sm font-semibold text-white mb-3">Quick Settlement</p>
          <div className="space-y-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-red-400 font-medium truncate">{memberName(s.from)}</span>
                <span className="text-slate-500 text-xs">→</span>
                <span className="text-green-400 font-medium truncate">{memberName(s.to)}</span>
                <span className="text-white font-bold ml-auto">{formatINR(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
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
  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Total Spent</p>
          <p className="text-2xl font-bold text-white">{formatINR(totalSpent)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-0.5">{isOver ? 'Over Budget' : 'Remaining'}</p>
          <p className={`text-2xl font-bold ${isOver ? 'text-red-400' : 'text-green-400'}`}>
            {formatINR(Math.abs(remaining))}
          </p>
        </div>
      </div>
      <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${budgetPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-500">{budgetPct.toFixed(0)}% used</span>
        <span className="text-[10px] text-slate-500">Budget: {formatINR(budget)}</span>
      </div>
    </div>
  )
}
