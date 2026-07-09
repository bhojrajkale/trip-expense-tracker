import { useState } from 'react'
import type { Expense, Trip } from '../../types'
import { formatINR, formatDate } from '../../utils/format'
import { getCategoryConfig, CATEGORIES } from '../CategoryConfig'
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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null)

  const q = searchQuery.trim().toLowerCase()
  const hasFilter = personFilter !== null || categoryFilter !== null || q !== ''

  const filtered = expenses.filter((e) => {
    if (personFilter && e.paidBy !== personFilter) return false
    if (categoryFilter && e.category !== categoryFilter) return false
    if (q) {
      const cat = getCategoryConfig(e.category)
      const label = (e.category === 'custom' ? (e.customCategory ?? '') : cat.label).toLowerCase()
      if (!label.includes(q) && !e.notes.toLowerCase().includes(q)) return false
    }
    return true
  })
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
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
        <span className="text-5xl mb-3">📋</span>
        <p className="text-sm">No expenses yet.</p>
        <p className="text-xs mt-1">Tap + to add your first expense.</p>
      </div>
    )
  }

  const chipBase =
    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap active:scale-95 transition-transform'
  const chipOn = 'bg-[var(--action)] text-white border-[var(--action)]'
  const chipOff = 'bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)]'

  // Only show category chips for categories that appear in this trip's expenses
  const usedCategories = CATEGORIES.filter((c) => expenses.some((e) => e.category === c.id))

  return (
    <div className="space-y-4 p-4 pb-32">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
        <input
          className="w-full bg-[var(--surface)] border border-[var(--hairline)] rounded-full pl-9 pr-4 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--action)]"
          placeholder="Search notes or category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-base leading-none active:opacity-50"
          >
            ✕
          </button>
        )}
      </div>

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

      {/* Category filter */}
      {usedCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`${chipBase} ${categoryFilter === null ? chipOn : chipOff}`}
          >
            All categories
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
              className={`${chipBase} ${categoryFilter === c.id ? chipOn : chipOff}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        {hasFilter ? (
          <span className="text-xs text-[var(--muted)]">
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''} · {formatINR(filteredTotal)}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => downloadCSV(trip, filtered)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--action)] bg-[var(--action-tint)] border border-[var(--action-border)] px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-14 text-[var(--muted)]">
          <span className="text-4xl mb-3">🔍</span>
          <p className="text-sm mb-4">No matching expenses.</p>
          <button
            onClick={() => { setPersonFilter(null); setCategoryFilter(null); setSearchQuery('') }}
            className="px-4 py-2 rounded-full border border-[var(--action)] text-[var(--action)] text-sm font-medium active:scale-95 transition-transform"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Full-screen receipt viewer */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center"
          onClick={() => setViewingReceipt(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none active:opacity-70"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
            onClick={() => setViewingReceipt(null)}
          >
            ✕
          </button>
          <img
            src={viewingReceipt}
            alt="Receipt"
            className="max-w-full max-h-full object-contain rounded-lg"
            style={{ maxHeight: '90dvh', padding: '48px 16px 32px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {Object.entries(grouped).map(([date, dayExpenses]) => (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              {formatDate(date)}
            </span>
            <span className="text-xs text-[var(--muted)]">
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
                  className="bg-[var(--surface)] rounded-[18px] overflow-hidden border border-[var(--hairline)]"
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
                        <span className="text-sm font-medium text-[var(--ink)]">
                          {exp.category === 'custom' && exp.customCategory ? exp.customCategory : cat.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {exp.receiptPhotoUrl && (
                            <button
                              onClick={() => setViewingReceipt(exp.receiptPhotoUrl!)}
                              className="text-[var(--action)] text-base leading-none active:opacity-50"
                              title="View receipt"
                            >
                              📷
                            </button>
                          )}
                          <span className="text-sm font-semibold text-[var(--ink)]">{formatINR(exp.amount)}</span>
                        </div>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                        Paid by {memberName(exp.paidBy)} · Split {exp.splitBetween.length} ways
                        {exp.createdByUid !== currentUid && addedByName(exp.createdByUid) && (
                          <> · Added by {addedByName(exp.createdByUid)}</>
                        )}
                      </div>
                      {exp.notes && (
                        <div className="text-xs text-[var(--muted)] mt-0.5 truncate">{exp.notes}</div>
                      )}
                    </div>
                  </div>

                  {!canModify(exp) ? null : isConfirming ? (
                    <div className="flex border-t border-[var(--divider)]">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-2.5 text-sm text-[var(--ink)] border-r border-[var(--divider)]"
                      >
                        Keep
                      </button>
                      <button
                        onClick={() => { onDelete(exp.id); setConfirmDelete(null) }}
                        className="flex-1 py-2.5 text-sm text-[var(--red)] font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex border-t border-[var(--divider)]">
                      <button
                        onClick={() => onEdit(exp)}
                        className="flex-1 py-2.5 text-xs text-[var(--action)] border-r border-[var(--divider)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(exp.id)}
                        className="flex-1 py-2.5 text-xs text-[var(--red)]"
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
