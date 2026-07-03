import { useState, useEffect } from 'react'
import type { Trip } from '../../types'
import type { User } from '../../utils/auth'
import { getTripForJoin, joinTrip } from '../../utils/firestore'
import { initials, formatDate } from '../../utils/format'

interface Props {
  tripId: string
  user: User
  // Called with the trip id on success / already-member, null on cancel or invalid link
  onDone: (tripId: string | null) => void
}

type Phase = 'loading' | 'invalid' | 'preview' | 'joining' | 'error'

export default function JoinTripScreen({ tripId, user, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [trip, setTrip] = useState<Trip | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTripForJoin(tripId).then((t) => {
      if (cancelled) return
      if (!t) {
        setPhase('invalid')
      } else if (t.memberUids.includes(user.uid)) {
        // Already a member — go straight in
        onDone(tripId)
      } else {
        setTrip(t)
        setPhase('preview')
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, user.uid])

  async function handleJoin() {
    if (!trip) return
    setPhase('joining')
    try {
      await joinTrip(
        tripId,
        {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        },
        trip,
        claimId ?? undefined
      )
      onDone(tripId)
    } catch (e) {
      console.error('join failed', e)
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="text-[#7a7a7a] text-sm">Loading invite…</div>
      </Shell>
    )
  }

  if (phase === 'invalid' || phase === 'error') {
    return (
      <Shell>
        <span className="text-5xl mb-4">🔗</span>
        <h1 className="text-xl font-semibold text-[#1d1d1f] mb-2">
          {phase === 'invalid' ? 'Invalid invite link' : 'Could not join'}
        </h1>
        <p className="text-[#7a7a7a] text-sm mb-8 max-w-xs">
          {phase === 'invalid'
            ? 'This trip may have been deleted, or the link is incomplete.'
            : 'Something went wrong while joining. Please try the link again.'}
        </p>
        <button
          onClick={() => onDone(null)}
          className="px-6 py-3 rounded-full bg-[#0066cc] text-white font-medium text-sm active:scale-95 transition-transform"
        >
          Continue to my trips
        </button>
      </Shell>
    )
  }

  const unclaimed = trip!.members.filter((m) => !m.uid)

  return (
    <Shell>
      <span className="text-5xl mb-4">✈️</span>
      <p className="text-[#7a7a7a] text-sm mb-1">You've been invited to join</p>
      <h1 className="text-2xl font-semibold text-[#1d1d1f] mb-1" style={{ letterSpacing: '-0.3px' }}>
        {trip!.name}
      </h1>
      <p className="text-[#7a7a7a] text-sm mb-6">
        {trip!.destination} · from {formatDate(trip!.startDate)}
      </p>

      {trip!.members.length > 0 && (
        <div className="w-full max-w-sm bg-white rounded-[18px] border border-[#e0e0e0] p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-[#7a7a7a] uppercase tracking-wider mb-3">
            {trip!.members.length} member{trip!.members.length > 1 ? 's' : ''} on this trip
          </p>
          <div className="flex flex-wrap gap-2">
            {trip!.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f5f7] text-sm text-[#1d1d1f]"
              >
                <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white text-[9px] font-semibold flex items-center justify-center">
                  {initials(m.name)}
                </span>
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {unclaimed.length > 0 && (
        <div className="w-full max-w-sm mb-6 text-left">
          <p className="text-xs font-semibold text-[#7a7a7a] uppercase tracking-wider mb-2">
            Are you one of these people?
          </p>
          <div className="bg-white rounded-[18px] border border-[#e0e0e0] overflow-hidden">
            {unclaimed.map((m) => (
              <button
                key={m.id}
                onClick={() => setClaimId(claimId === m.id ? null : m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f0] last:border-0 text-left transition-colors ${
                  claimId === m.id ? 'bg-[#0066cc]/8' : ''
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] text-white ${
                    claimId === m.id ? 'bg-[#0066cc] border-[#0066cc]' : 'border-[#cccccc]'
                  }`}
                >
                  {claimId === m.id ? '✓' : ''}
                </span>
                <span className="text-sm text-[#1d1d1f]">{m.name}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#7a7a7a] mt-2">
            Selecting your name links your account to your existing expenses.
            Leave unselected to join as a new member.
          </p>
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={phase === 'joining'}
        className="w-full max-w-sm py-3.5 rounded-full bg-[#0066cc] text-white font-medium text-base disabled:opacity-50 active:scale-95 transition-transform"
      >
        {phase === 'joining'
          ? 'Joining…'
          : claimId
            ? `Join as ${trip!.members.find((m) => m.id === claimId)?.name}`
            : 'Join as new member'}
      </button>

      <button
        onClick={() => onDone(null)}
        className="mt-4 text-[#7a7a7a] text-sm active:opacity-60"
      >
        Not now
      </button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-[#f5f5f7] p-6 text-center"
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </div>
  )
}
