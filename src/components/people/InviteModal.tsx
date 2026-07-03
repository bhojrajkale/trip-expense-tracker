import { useState } from 'react'
import type { Trip } from '../../types'
import { shareOrCopy } from '../../utils/share'

interface Props {
  trip: Trip
  onClose: () => void
}

export default function InviteModal({ trip, onClose }: Props) {
  const [feedback, setFeedback] = useState<'shared' | 'copied' | null>(null)

  const link = `${location.origin}${import.meta.env.BASE_URL}?join=${trip.id}`
  const message = `Join my trip "${trip.name}" on TripTracker and add your expenses:\n${link}`

  async function handleShare() {
    try {
      const result = await shareOrCopy(`Join ${trip.name}`, message)
      setFeedback(result)
      if (result === 'shared') setTimeout(onClose, 500)
    } catch {
      // user dismissed the share sheet — not an error
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-[#f5f5f7] rounded-t-[18px] border-t border-[#e0e0e0] p-6 pb-safe">
        <div className="w-10 h-1 bg-[#cccccc] rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-[#1d1d1f] mb-1" style={{ letterSpacing: '-0.3px' }}>
          Invite to {trip.name}
        </h2>
        <p className="text-[#7a7a7a] text-sm mb-4">
          Anyone with this link can sign in with Google and join the trip to add their expenses.
        </p>

        <div className="bg-white border border-[#e0e0e0] rounded-[11px] px-4 py-3 mb-4 text-xs text-[#7a7a7a] break-all select-all">
          {link}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-[#0066cc] text-[#0066cc] font-medium text-sm active:scale-95 transition-transform"
          >
            Close
          </button>
          <button
            onClick={handleShare}
            className={`flex-1 py-3 rounded-full text-white font-medium text-sm active:scale-95 transition-transform ${
              feedback === 'copied' ? 'bg-green-600' : 'bg-[#0066cc]'
            }`}
          >
            {feedback === 'copied' ? '✓ Copied' : feedback === 'shared' ? '✓ Shared' : 'Share Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
