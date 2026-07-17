import { useState, useRef } from 'react'
import type { Expense, Trip, SplitAmount } from '../../types'
import { CATEGORIES } from '../CategoryConfig'
import { todayISO, formatINR } from '../../utils/format'
import { compressToDataUrl } from '../../utils/imageCompress'

interface Props {
  trip: Trip
  editExpense?: Expense
  // createdByUid is stamped by the caller (new: current uid, edit: preserved)
  onSave: (expense: Omit<Expense, 'createdByUid'>) => void
  onCancel: () => void
}

type SplitMode = 'equal' | 'custom'

export default function AddExpenseForm({ trip, editExpense, onSave, onCancel }: Props) {
  const isEdit = !!editExpense

  // Pre-generate ID so we can use it as the Storage filename before submit
  const [expenseId] = useState(() => editExpense?.id ?? crypto.randomUUID())

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

  // Receipt state
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(editExpense?.receiptPhotoUrl)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const amountNum = parseFloat(amount) || 0
  const perPerson = splitBetween.length > 0 ? amountNum / splitBetween.length : 0

  function toggleMember(id: string) {
    setSplitBetween((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  async function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setReceiptUploading(true)
    setReceiptError('')
    try {
      const dataUrl = await compressToDataUrl(file)
      setReceiptUrl(dataUrl)
    } catch {
      setReceiptError('Could not process image. Please try again.')
    } finally {
      setReceiptUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || amt > 9999999) return setError('Enter a valid amount (₹1 – ₹99,99,999)')
    if (category === 'custom' && !customCategoryName.trim()) return setError('Enter a category name')
    if (!paidBy) return setError('Select who paid')
    if (splitBetween.length === 0) return setError('Select at least one person to split with')
    // Firestore rules require a YYYY-MM-DD date — desktop browsers allow
    // clearing the date input, which would make the save silently fail
    if (!date) return setError('Select a date')

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
      id: expenseId,
      tripId: trip.id,
      amount: amt,
      category,
      customCategory: category === 'custom' ? customCategoryName.trim().slice(0, 50) : undefined,
      paidBy,
      splitBetween,
      splitAmounts,
      date,
      notes: notes.trim().slice(0, 200),
      receiptPhotoUrl: receiptUrl,
    })
  }

  const inputClass = "w-full bg-[var(--surface)] border border-[var(--hairline)] rounded-[11px] px-4 py-3 text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--action)] text-sm"

  return (
    <div className="p-4 space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.3px' }}>
          {isEdit ? 'Edit Expense' : 'Add Expense'}
        </h2>
        {isEdit && (
          <button onClick={onCancel} className="text-[var(--action)] text-sm">Cancel</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4">
          <label className="block text-xs text-[var(--muted)] mb-2 font-medium">Amount (₹)</label>
          <div className="flex items-center gap-2">
            <span className="text-2xl text-[var(--muted)]">₹</span>
            <input
              className="flex-1 bg-transparent text-3xl font-semibold text-[var(--ink)] placeholder-[var(--disabled)] focus:outline-none"
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
          <label className="block text-xs text-[var(--muted)] mb-2 font-medium">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-[18px] border text-xs font-medium transition-all ${
                  category === cat.id
                    ? 'border-[var(--action)] bg-[var(--action-tint)] text-[var(--action)]'
                    : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
          {category === 'custom' && (
            <input
              className={`mt-2 ${inputClass} border-[var(--action-border-half)]`}
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
          <label className="block text-xs text-[var(--muted)] mb-2 font-medium">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaidBy(m.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  paidBy === m.id
                    ? 'bg-[var(--action)] border-[var(--action)] text-white'
                    : 'bg-[var(--surface)] border-[var(--hairline)] text-[var(--ink)]'
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
            <label className="text-xs text-[var(--muted)] font-medium">Split between</label>
            <div className="flex bg-[var(--bg)] rounded-lg overflow-hidden border border-[var(--hairline)]">
              {(['equal', 'custom'] as SplitMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    splitMode === mode ? 'bg-[var(--action)] text-white rounded-lg' : 'text-[var(--muted)]'
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
                    isIn ? 'border-[var(--action-border)] bg-[var(--action-tint-5)]' : 'border-[var(--hairline)] bg-[var(--surface)] opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isIn ? 'bg-[var(--action)] border-[var(--action)]' : 'border-[var(--disabled)]'
                    }`}
                  >
                    {isIn && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className="flex-1 text-sm text-[var(--ink)]">{m.name}</span>
                  {isIn && splitMode === 'equal' && (
                    <span className="text-sm text-[var(--action)]">{formatINR(perPerson)}</span>
                  )}
                  {isIn && splitMode === 'custom' && (
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--muted)] text-xs">₹</span>
                      <input
                        className="w-20 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg px-2 py-1 text-sm text-[var(--ink)] text-right focus:outline-none focus:border-[var(--action)]"
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

        {/* Date & Notes — min-w-0 lets each column shrink to 50%; without it
            iOS Safari's native date input keeps its intrinsic width and
            overflows onto the Notes field. */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-[var(--muted)] mb-1 font-medium">Date</label>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-[var(--muted)] mb-1 font-medium">Notes</label>
            <input
              className={inputClass}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        {/* Receipt */}
        <div>
          <label className="block text-xs text-[var(--muted)] mb-2 font-medium">Receipt</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleReceiptSelect}
          />

          {receiptUrl ? (
            <div className="relative w-24 h-24">
              <img
                src={receiptUrl}
                alt="Receipt"
                className="w-24 h-24 rounded-[11px] object-cover border border-[var(--hairline)]"
              />
              <button
                type="button"
                onClick={() => setReceiptUrl(undefined)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--ink)] rounded-full flex items-center justify-center text-[var(--bg)] text-xs leading-none active:scale-90 transition-transform"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptUploading}
              className="flex items-center gap-2 px-4 py-3 rounded-[11px] border border-dashed border-[var(--disabled)] bg-[var(--surface)] text-[var(--muted)] text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {receiptUploading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-[var(--action)] border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>📷 Add Receipt</>
              )}
            </button>
          )}
          {receiptError && <p className="text-[var(--red)] text-xs mt-1">{receiptError}</p>}
        </div>

        {error && <p className="text-[var(--red)] text-sm">{error}</p>}

        {trip.members.length === 0 && (
          <p className="text-[var(--orange)] text-sm bg-[var(--orange-tint)] rounded-[11px] p-3">
            Add members in the People tab before logging expenses.
          </p>
        )}

        <button
          type="submit"
          disabled={trip.members.length === 0 || receiptUploading}
          className="w-full py-4 rounded-full bg-[var(--action)] text-white font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          {isEdit ? 'Save Changes' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
