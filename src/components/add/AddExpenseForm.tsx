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

  return (
    <div className="p-4 space-y-5 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
        {isEdit && (
          <button onClick={onCancel} className="text-slate-400 text-sm">
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <label className="block text-xs text-slate-400 mb-2">Amount (₹)</label>
          <div className="flex items-center gap-2">
            <span className="text-2xl text-slate-400">₹</span>
            <input
              className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-slate-600 focus:outline-none"
              placeholder="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all ${
                  category === cat.id
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
          {category === 'custom' && (
            <input
              className="mt-2 w-full bg-slate-800 border border-indigo-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
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
          <label className="block text-xs text-slate-400 mb-2">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaidBy(m.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  paidBy === m.id
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
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
            <label className="text-xs text-slate-400">Split between</label>
            <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              {(['equal', 'custom'] as SplitMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    splitMode === mode
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400'
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
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isIn ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-slate-700 bg-slate-800 opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isIn ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                    }`}
                  >
                    {isIn && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className="flex-1 text-sm text-white">{m.name}</span>
                  {isIn && splitMode === 'equal' && (
                    <span className="text-sm text-indigo-300">{formatINR(perPerson)}</span>
                  )}
                  {isIn && splitMode === 'custom' && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-xs">₹</span>
                      <input
                        className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-indigo-500"
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
            <label className="block text-xs text-slate-400 mb-1">Date</label>
            <input
              type="date"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {trip.members.length === 0 && (
          <p className="text-amber-400 text-sm bg-amber-400/10 rounded-xl p-3">
            Add members in the People tab before logging expenses.
          </p>
        )}

        <button
          type="submit"
          disabled={trip.members.length === 0}
          className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {isEdit ? 'Save Changes' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
