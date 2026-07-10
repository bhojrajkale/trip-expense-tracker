import { useState } from 'react'
import type { Trip } from '../types'
import { todayISO } from '../utils/format'

interface Props {
  editTrip?: Trip
  // Pre-fills fields from a past trip but creates a new one (start date resets to today)
  duplicateFrom?: Trip
  // ownerUid/memberUids are stamped by the store when the trip is created
  onSave: (trip: Omit<Trip, 'ownerUid' | 'memberUids'>) => void
  onClose: () => void
}

export default function TripModal({ editTrip, duplicateFrom, onSave, onClose }: Props) {
  const source = editTrip ?? duplicateFrom
  const [name, setName] = useState(
    editTrip?.name ?? (duplicateFrom ? `${duplicateFrom.name} (copy)`.slice(0, 50) : '')
  )
  const [destination, setDestination] = useState(source?.destination ?? '')
  const [budget, setBudget] = useState(source ? String(source.budget) : '')
  const [startDate, setStartDate] = useState(editTrip?.startDate ?? todayISO())
  const [error, setError] = useState('')

  const isEditing = !!editTrip

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimName = name.trim().slice(0, 50)
    const trimDest = destination.trim().slice(0, 50)
    const budgetNum = parseFloat(budget)

    if (!trimName) return setError('Trip name is required')
    if (!trimDest) return setError('Destination is required')
    if (isNaN(budgetNum) || budgetNum <= 0 || budgetNum > 9999999)
      return setError('Enter a valid budget (₹1 – ₹99,99,999)')

    onSave({
      id: editTrip?.id ?? crypto.randomUUID(),
      name: trimName,
      destination: trimDest,
      startDate,
      budget: budgetNum,
      members: editTrip?.members ?? [],
    })
  }

  const inputClass = "w-full bg-[var(--surface)] border border-[var(--hairline)] rounded-[11px] px-4 py-3 text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--action)] text-sm"

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full bg-[var(--bg)] rounded-t-[18px] border-t border-[var(--hairline)] p-6"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-[var(--disabled)] rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-4" style={{ letterSpacing: '-0.3px' }}>
          {isEditing ? 'Edit Trip' : duplicateFrom ? 'Duplicate Trip' : 'New Trip'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 font-medium">Trip Name</label>
            <input
              className={inputClass}
              placeholder="Goa Trip 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 font-medium">Destination</label>
            <input
              className={inputClass}
              placeholder="Goa, India"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 font-medium">Start Date</label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 font-medium">Total Budget (₹)</label>
            <input
              className={inputClass}
              placeholder="50000"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          {error && <p className="text-[var(--red)] text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full border border-[var(--action)] text-[var(--action)] font-medium text-sm active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-full bg-[var(--action)] text-white font-medium text-sm active:scale-95 transition-transform"
            >
              {isEditing ? 'Save Changes' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
