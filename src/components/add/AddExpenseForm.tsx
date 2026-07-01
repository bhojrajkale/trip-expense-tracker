import { useState } from 'react'
import type { Expense, Trip, SplitAmount } from '../../types'
import { CATEGORIES } from '../CategoryConfig'
import { todayISO, formatINR } from '../../utils/format'

interface Props {
  trip: Trip
  editExpense?: Expense
  onSave: (expense: Expense) => void
  onCancel: () => void
}

type SplitMode = 'equal' | 'custom'

export default function AddExpenseForm({ trip, editExpense, onSave, onCancel }: Props) {
  const isEdit = !!editExpense

  const [amount, setAmount] = useState(editExpense ? String(editExpense.amount) : '')
  const [category, setCategory] = useState(editExpense?.category ?? 'food')
  const [customCategoryName, setCustomCategoryName] = useState(editExpense?.customCategory ?? '')
  const [paidBy, setPaidBy] = useState(editExpense?.paidBy ?? trip.members[0]?.id ?? '')
  const [splitBetween, setSplitBetween] = useState<string[]>(
    editExpense?.splitBetween ?? trip.members.map((m) => m.id)
  )
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editExpense?.splitAmounts ? 'custom' : 'equal'
  )
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (editExpense?.splitAmounts) {
      return Object.fromEntries(editExpense.splitAmounts.map((s) => [s.memberId, String(s.amount)]))
    }
    return {}
  })
  const [date, setDate] = useState(editExpense?.date ?? todayISO())
  const [notes, setNotes] = useState(editExpense?.notes ?? '')
  const [error, setError] = useState('')

  const amountNum = parseFloat(amount) || 0
  const perPerson = splitBetween.length > 0 ? amountNum / splitBetween.length : 0

  function toggleMember(id: string) {
    setSplitBetween((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || amt > 9999999) return setError('Enter a valid amount (₹1 – ₹99,99,999)')
    if (category === 'custom' && !customCategoryName.trim()) return setError('Enter a category name')
    if (!paidBy) return setError('Select who paid')
    if (splitBetween.length === 0) return setError('Select at least one person to split with')

    let splitAmounts: SplitAmount[] | undefined
    if (splitMode === 'custom') {
      const entries: SplitAmount[] = splitBetween.map((id) => ({
        memberId: id,
        amount: parseFloat(customAmounts[id] ?? '0') || 0,
      }))
      const total = entries.reduce((s, e) => s + e.amount, 0)
      if (Math.abs(total - amt) > 1) {
        return setError(`Custom split total (${formatINR(total)}) must equal ${formatINR(amt)}`)
      }
      splitAmounts = entries
    }

    onSave({
      id: editExpense?.id ?? crypto.randomUUID(),
      tripId: trip.id,
      amount: amt,
      category,
      customCategory: category === 'custom' ? customCategoryName.trim().slice(0, 50) : undefined,
      paidBy,
      splitBetween,
      splitAmounts,
      date,
      notes: notes.trim().slice(0, 200),
    })
  }

  const inputClass = "w-full bg-white border border-[#e0e0e0] rounded-[11px] px-4 py-3 text-[#1d1d1f] placeholder-[#7a7a7a] focus:outline-none focus:border-[#0066cc] text-sm"

  return (
    <div className="p-4 space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1d1d1f]" style={{ letterSpacing: '-0.3px' }}>
          {isEdit ? 'Edit Expense' : 'Add Expense'}
        </h2>
        {isEdit && (
          <button onClick={onCancel} className="text-[#0066cc] text-sm">Cancel</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div className="bg-white border border-[#e0e0e0] rounded-[18px] p-4">
          <label className="block text-xs text-[#7a7a7a] mb-2 font-medium">Amount (₹)</label>
          <div className="flex items-center gap-2">
            <span className="text-2xl text-[#7a7a7a]">₹</span>
            <input
              className="flex-1 bg-transparent text-3xl font-semibold text-[#1d1d1f] placeholder-[#cccccc] focus:outline-none"
              placeholder="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              style={{ letterSpacing: '-0.5px' }}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-[#7a7a7a] mb-2 font-medium">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-[18px] border text-xs font-medium transition-all ${
                  category === cat.id
                    ? 'border-[#0066cc] bg-[#0066cc]/8 text-[#0066cc]'
                    : 'border-[#e0e0e0] bg-white text-[#7a7a7a]'
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
          {category === 'custom' && (
            <input
              className={`mt-2 ${inputClass} border-[#0066cc]/50`}
              placeholder="Enter category name (e.g. Medicine, Tickets…)"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          )}
        </div>

        {/* Paid by */}
        <div>
          <label className="block text-xs text-[#7a7a7a] mb-2 font-medium">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaidBy(m.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  paidBy === m.id
                    ? 'bg-[#0066cc] border-[#0066cc] text-white'
                    : 'bg-white border-[#e0e0e0] text-[#1d1d1f]'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Split */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-[#7a7a7a] font-medium">Split between</label>
            <div className="flex bg-[#f5f5f7] rounded-lg overflow-hidden border border-[#e0e0e0]">
              {(['equal', 'custom'] as SplitMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    splitMode === mode ? 'bg-[#0066cc] text-white rounded-lg' : 'text-[#7a7a7a]'
                  }`}
                >
                  {mode === 'equal' ? 'Equal' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {trip.members.map((m) => {
              const isIn = splitBetween.includes(m.id)
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded-[18px] border transition-all ${
                    isIn ? 'border-[#0066cc]/30 bg-[#0066cc]/5' : 'border-[#e0e0e0] bg-white opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isIn ? 'bg-[#0066cc] border-[#0066cc]' : 'border-[#cccccc]'
                    }`}
                  >
                    {isIn && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className="flex-1 text-sm text-[#1d1d1f]">{m.name}</span>
                  {isIn && splitMode === 'equal' && (
                    <span className="text-sm text-[#0066cc]">{formatINR(perPerson)}</span>
                  )}
                  {isIn && splitMode === 'custom' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[#7a7a7a] text-xs">₹</span>
                      <input
                        className="w-20 bg-white border border-[#e0e0e0] rounded-lg px-2 py-1 text-sm text-[#1d1d1f] text-right focus:outline-none focus:border-[#0066cc]"
                        inputMode="decimal"
                        placeholder="0"
                        value={customAmounts[m.id] ?? ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Date & Notes */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-[#7a7a7a] mb-1 font-medium">Date</label>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[#7a7a7a] mb-1 font-medium">Notes</label>
            <input
              className={inputClass}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {trip.members.length === 0 && (
          <p className="text-[#ff9500] text-sm bg-[#ff9500]/10 rounded-[11px] p-3">
            Add members in the People tab before logging expenses.
          </p>
        )}

        <button
          type="submit"
          disabled={trip.members.length === 0}
          className="w-full py-4 rounded-full bg-[#0066cc] text-white font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          {isEdit ? 'Save Changes' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
