import { useState } from 'react'
import type { Expense, Trip } from '../../types'
import { formatINR, formatDate } from '../../utils/format'
import { getCategoryConfig } from '../CategoryConfig'
import { downloadCSV } from '../../utils/export'

interface Props {
  expenses: Expense[]
  trip: Trip
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

export default function ExpenseList({ expenses, trip, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))

  const grouped = sorted.reduce<Record<string, Expense[]>>((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = []
    acc[exp.date].push(exp)
    return acc
  }, {})

  const memberName = (id: string) =>
    trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <span className="text-5xl mb-3">📋</span>
        <p className="text-sm">No expenses yet.</p>
        <p className="text-xs mt-1">Tap + to add your first expense.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-32">
      <div className="flex justify-end">
        <button
          onClick={() => downloadCSV(trip, expenses)}
          className="text-xs text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg active:opacity-70"
        >
          Export CSV
        </button>
      </div>
      {Object.entries(grouped).map(([date, dayExpenses]) => (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {formatDate(date)}
            </span>
            <span className="text-xs text-slate-500">
              {formatINR(dayExpenses.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {dayExpenses.map((exp) => {
              const cat = getCategoryConfig(exp.category)
              const isConfirming = confirmDelete === exp.id
              return (
                <div
                  key={exp.id}
                  className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ backgroundColor: cat.color + '22' }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          {exp.category === 'custom' && exp.customCategory ? exp.customCategory : cat.label}
                        </span>
                        <span className="text-sm font-bold text-white">{formatINR(exp.amount)}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        Paid by {memberName(exp.paidBy)} · Split {exp.splitBetween.length} ways
                      </div>
                      {exp.notes && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{exp.notes}</div>
                      )}
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex border-t border-slate-700">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2.5 text-sm text-slate-300 border-r border-slate-700"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => {
                          onDelete(exp.id)
                          setConfirmDelete(null)
                        }}
                        className="flex-1 py-2.5 text-sm text-red-400 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex border-t border-slate-700">
                      <button
                        onClick={() => onEdit(exp)}
                        className="flex-1 py-2.5 text-xs text-slate-400 border-r border-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(exp.id)}
                        className="flex-1 py-2.5 text-xs text-red-400/70"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
