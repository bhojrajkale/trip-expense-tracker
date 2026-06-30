import { useState } from 'react'
import type { Trip } from '../types'
import { todayISO } from '../utils/format'

interface Props {
  onSave: (trip: Trip) => void
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-slate-900 rounded-t-2xl border-t border-slate-700 p-6 pb-safe">
        <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-white mb-4">New Trip</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Trip Name</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Goa Trip 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Destination</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Goa, India"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Total Budget (₹)</label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="50000"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-semibold"
            >
              Create Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
