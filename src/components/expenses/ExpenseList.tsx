import { useState } from 'react'
import type { Expense, Trip } from '../../types'
import { formatINR, formatDate } from '../../utils/format'
import { getCategoryConfig } from '../CategoryConfig'
import { downloadCSV } from '../../utils/export'

interface Props {
  expenses: Expense[]
  trip: Trip
  currentUid: string
  isOwner: boolean
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

export default function ExpenseList({ expenses, trip, currentUid, isOwner, onEdit, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [personFilter, setPersonFilter] = useState<string | null>(null)

  const hasFilter = personFilter !== null

  const filtered = expenses.filter((e) => !personFilter || e.paidBy === personFilter)
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0)

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const grouped = sorted.reduce<Record<string, Expense[]>>((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = []
    acc[exp.date].push(exp)
    return acc
  }, {})

  const memberName = (id: string) =>
    trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  const addedByName = (uid: string) =>
    trip.members.find((m) => m.uid === uid)?.name ?? null

  // Rules only allow the creator (or trip owner) to modify an expense —
  // hide controls that would be denied server-side anyway
  const canModify = (exp: Expense) => isOwner || exp.createdByUid === currentUid

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#7a7a7a]">
        <span className="text-5xl mb-3">📋</span>
        <p className="text-sm">No expenses yet.</p>
        <p className="text-xs mt-1">Tap + to add your first expense.</p>
      </div>
    )
  }

  const chipBase =
    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap active:scale-95 transition-transform'
  const chipOn = 'bg-[#0066cc] text-white border-[#0066cc]'
  const chipOff = 'bg-white text-[#1d1d1f] border-[#e0e0e0]'

  return (
    <div className="space-y-4 p-4 pb-32">
      {/* Person (paid by) filter */}
      {trip.members.length > 1 && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
          <button
            onClick={() => setPersonFilter(null)}
            className={`${chipBase} ${personFilter === null ? chipOn : chipOff}`}
          >
            Paid by anyone
          </button>
          {trip.members.map((m) => (
            <button
              key={m.id}
              onClick={() => setPersonFilter(personFilter === m.id ? null : m.id)}
              className={`${chipBase} ${personFilter === m.id ? chipOn : chipOff}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {hasFilter ? (
          <span className="text-xs text-[#7a7a7a]">
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''} · {formatINR(filteredTotal)}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => downloadCSV(trip, filtered)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#0066cc] bg-[#0066cc]/8 border border-[#0066cc]/30 px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-14 text-[#7a7a7a]">
          <span className="text-4xl mb-3">🔍</span>
          <p className="text-sm mb-4">No matching expenses.</p>
          <button
            onClick={() => setPersonFilter(null)}
            className="px-4 py-2 rounded-full border border-[#0066cc] text-[#0066cc] text-sm font-medium active:scale-95 transition-transform"
          >
            Clear filter
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([date, dayExpenses]) => (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#7a7a7a] uppercase tracking-wider">
              {formatDate(date)}
            </span>
            <span className="text-xs text-[#7a7a7a]">
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
                  className="bg-white rounded-[18px] overflow-hidden border border-[#e0e0e0]"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-10 h-10 rounded-[11px] flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ backgroundColor: cat.color + '18' }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#1d1d1f]">
                          {exp.category === 'custom' && exp.customCategory ? exp.customCategory : cat.label}
                        </span>
                        <span className="text-sm font-semibold text-[#1d1d1f]">{formatINR(exp.amount)}</span>
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-0.5 truncate">
                        Paid by {memberName(exp.paidBy)} · Split {exp.splitBetween.length} ways
                        {exp.createdByUid !== currentUid && addedByName(exp.createdByUid) && (
                          <> · Added by {addedByName(exp.createdByUid)}</>
                        )}
                      </div>
                      {exp.notes && (
                        <div className="text-xs text-[#7a7a7a] mt-0.5 truncate">{exp.notes}</div>
                      )}
                    </div>
                  </div>

                  {!canModify(exp) ? null : isConfirming ? (
                    <div className="flex border-t border-[#f0f0f0]">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2.5 text-sm text-[#333333] border-r border-[#f0f0f0]"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => { onDelete(exp.id); setConfirmDelete(null) }}
                        className="flex-1 py-2.5 text-sm text-red-500 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex border-t border-[#f0f0f0]">
                      <button
                        onClick={() => onEdit(exp)}
                        className="flex-1 py-2.5 text-xs text-[#0066cc] border-r border-[#f0f0f0]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(exp.id)}
                        className="flex-1 py-2.5 text-xs text-red-400"
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
