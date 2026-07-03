import { useState } from 'react'
import type { Trip } from '../types'
import { todayISO } from '../utils/format'

interface Props {
  // ownerUid/memberUids are stamped by the store when the trip is created
  onSave: (trip: Omit<Trip, 'ownerUid' | 'memberUids'>) => void
  onClose: () => void
}

export default function TripModal({ onSave, onClose }: Props) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [budget, setBudget] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [error, setError] = useState('')

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
      id: crypto.randomUUID(),
      name: trimName,
      destination: trimDest,
      startDate,
      budget: budgetNum,
      members: [],
    })
  }

  const inputClass = "w-full bg-white border border-[#e0e0e0] rounded-[11px] px-4 py-3 text-[#1d1d1f] placeholder-[#7a7a7a] focus:outline-none focus:border-[#0066cc] text-sm"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-[#f5f5f7] rounded-t-[18px] border-t border-[#e0e0e0] p-6 pb-safe">
        <div className="w-10 h-1 bg-[#cccccc] rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4" style={{ letterSpacing: '-0.3px' }}>New Trip</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#7a7a7a] mb-1.5 font-medium">Trip Name</label>
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
            <label className="block text-xs text-[#7a7a7a] mb-1.5 font-medium">Destination</label>
            <input
              className={inputClass}
              placeholder="Goa, India"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[#7a7a7a] mb-1.5 font-medium">Total Budget (₹)</label>
              <input
                className={inputClass}
                placeholder="50000"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#7a7a7a] mb-1.5 font-medium">Start Date</label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full border border-[#0066cc] text-[#0066cc] font-medium text-sm active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-full bg-[#0066cc] text-white font-medium text-sm active:scale-95 transition-transform"
            >
              Create Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
