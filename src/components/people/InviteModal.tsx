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
      className="fixed inset-0 z-[200] flex items-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full bg-[var(--bg)] rounded-t-[18px] border-t border-[var(--hairline)] p-6"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-[var(--disabled)] rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-1" style={{ letterSpacing: '-0.3px' }}>
          Invite to {trip.name}
        </h2>
        <p className="text-[var(--muted)] text-sm mb-4">
          Anyone with this link can sign in with Google and join the trip to add their expenses.
        </p>

        <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-[11px] px-4 py-3 mb-4 text-xs text-[var(--muted)] break-all select-all">
          {link}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-[var(--action)] text-[var(--action)] font-medium text-sm active:scale-95 transition-transform"
          >
            Close
          </button>
          <button
            onClick={handleShare}
            className={`flex-1 py-3 rounded-full text-white font-medium text-sm active:scale-95 transition-transform ${
              feedback === 'copied' ? 'bg-[var(--green)]' : 'bg-[var(--action)]'
            }`}
          >
            {feedback === 'copied' ? '✓ Copied' : feedback === 'shared' ? '✓ Shared' : 'Share Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
