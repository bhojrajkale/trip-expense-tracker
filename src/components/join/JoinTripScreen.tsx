import { useState, useEffect } from 'react'
import type { TripPreview } from '../../types'
import type { User } from '../../utils/auth'
import { getTripPreview, getJoinRequest, requestToJoin, subscribeJoinRequest } from '../../utils/firestore'
import { initials, formatDate } from '../../utils/format'

interface Props {
  tripId: string
  user: User
  // Called with the trip id on success / already-member, null on cancel or invalid link
  onDone: (tripId: string | null) => void
}

type Phase = 'loading' | 'invalid' | 'denied' | 'network' | 'preview' | 'requesting' | 'pending' | 'declined' | 'error'

function isPermissionDenied(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === 'permission-denied'
}

export default function JoinTripScreen({ tripId, user, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [trip, setTrip] = useState<TripPreview | null>(null)
  const [claimId, setClaimId] = useState<string | null>(null)

  // Load the preview; short-circuit if already a member or already requested.
  useEffect(() => {
    let cancelled = false
    getTripPreview(tripId)
      .then(async (t) => {
        if (cancelled) return
        if (!t) {
          setPhase('invalid')
        } else if (t.memberUids.includes(user.uid)) {
          onDone(tripId)
        } else {
          setTrip(t)
          const existing = await getJoinRequest(tripId, user.uid)
          if (cancelled) return
          setPhase(existing ? 'pending' : 'preview')
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.error('preview load failed', e)
        setPhase(isPermissionDenied(e) ? 'denied' : 'network')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, user.uid])

  // While pending, watch our own request doc. It disappears when the owner
  // approves (after adding us to the trip) or declines — re-check membership
  // to tell the two apart.
  useEffect(() => {
    if (phase !== 'pending') return
    let seen = false
    return subscribeJoinRequest(tripId, user.uid, async (req) => {
      if (req) {
        seen = true
        return
      }
      if (!seen) return // initial snapshot with no doc yet — ignore
      try {
        const t = await getTripPreview(tripId)
        if (t?.memberUids.includes(user.uid)) onDone(tripId)
        else setPhase('declined')
      } catch (e) {
        // Request doc is gone but we couldn't confirm approval vs decline —
        // don't guess either way, surface it so the user can retry.
        console.error('post-approval recheck failed', e)
        setPhase(isPermissionDenied(e) ? 'denied' : 'network')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tripId, user.uid])

  async function handleRequest() {
    setPhase('requesting')
    try {
      await requestToJoin(
        tripId,
        { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL },
        claimId ?? undefined
      )
      setPhase('pending')
    } catch (e) {
      console.error('join request failed', e)
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="text-[var(--muted)] text-sm">Loading invite…</div>
      </Shell>
    )
  }

  if (phase === 'invalid' || phase === 'error' || phase === 'denied' || phase === 'network') {
    const copy = {
      invalid: {
        title: 'Invalid invite link',
        body: 'This trip may have been deleted, or the link is incomplete.',
        cta: 'Continue to my trips',
        reload: false,
      },
      denied: {
        title: 'Could not load invite',
        body: "This can happen right after an app update — try reloading the page. If it keeps happening, ask for a fresh invite link.",
        cta: 'Reload',
        reload: true,
      },
      network: {
        title: 'Connection problem',
        body: 'Check your internet connection and try again.',
        cta: 'Retry',
        reload: true,
      },
      error: {
        title: 'Could not send request',
        body: 'Something went wrong. Please try the link again.',
        cta: 'Continue to my trips',
        reload: false,
      },
    }[phase]

    return (
      <Shell>
        <span className="text-5xl mb-4">🔗</span>
        <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">{copy.title}</h1>
        <p className="text-[var(--muted)] text-sm mb-8 max-w-xs">{copy.body}</p>
        <button
          onClick={() => (copy.reload ? location.reload() : onDone(null))}
          className="px-6 py-3 rounded-full bg-[var(--action)] text-white font-medium text-sm active:scale-95 transition-transform"
        >
          {copy.cta}
        </button>
      </Shell>
    )
  }

  if (phase === 'pending') {
    return (
      <Shell>
        <span className="text-5xl mb-4">⏳</span>
        <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">Request sent</h1>
        <p className="text-[var(--muted)] text-sm mb-8 max-w-xs">
          Waiting for the trip owner to approve you{trip ? ` for ${trip.name}` : ''}. You'll be let
          in automatically once they do — you can leave this page open or check back later.
        </p>
        <button
          onClick={() => onDone(null)}
          className="text-[var(--muted)] text-sm active:opacity-60"
        >
          Back to my trips
        </button>
      </Shell>
    )
  }

  if (phase === 'declined') {
    return (
      <Shell>
        <span className="text-5xl mb-4">🚫</span>
        <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">Request declined</h1>
        <p className="text-[var(--muted)] text-sm mb-8 max-w-xs">
          The trip owner didn't approve your request to join{trip ? ` ${trip.name}` : ''}.
        </p>
        <button
          onClick={() => onDone(null)}
          className="px-6 py-3 rounded-full bg-[var(--action)] text-white font-medium text-sm active:scale-95 transition-transform"
        >
          Back to my trips
        </button>
      </Shell>
    )
  }

  const unclaimed = trip!.members.filter((m) => !m.uid)
  const busy = phase === 'requesting'

  return (
    <Shell>
      <span className="text-5xl mb-4">✈️</span>
      <p className="text-[var(--muted)] text-sm mb-1">You've been invited to join</p>
      <h1 className="text-2xl font-semibold text-[var(--ink)] mb-1" style={{ letterSpacing: '-0.3px' }}>
        {trip!.name}
      </h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        {trip!.destination} · from {formatDate(trip!.startDate)}
      </p>

      {trip!.members.length > 0 && (
        <div className="w-full max-w-sm bg-[var(--surface)] rounded-[18px] border border-[var(--hairline)] p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
            {trip!.members.length} member{trip!.members.length > 1 ? 's' : ''} on this trip
          </p>
          <div className="flex flex-wrap gap-2">
            {trip!.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg)] text-sm text-[var(--ink)]"
              >
                <span className="w-5 h-5 rounded-full bg-[var(--action)] text-white text-[9px] font-semibold flex items-center justify-center">
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
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            Are you one of these people?
          </p>
          <div className="bg-[var(--surface)] rounded-[18px] border border-[var(--hairline)] overflow-hidden">
            {unclaimed.map((m) => (
              <button
                key={m.id}
                onClick={() => setClaimId(claimId === m.id ? null : m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--divider)] last:border-0 text-left transition-colors ${
                  claimId === m.id ? 'bg-[var(--action-tint)]' : ''
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[10px] text-white ${
                    claimId === m.id ? 'bg-[var(--action)] border-[var(--action)]' : 'border-[var(--disabled)]'
                  }`}
                >
                  {claimId === m.id ? '✓' : ''}
                </span>
                <span className="text-sm text-[var(--ink)]">{m.name}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">
            Selecting your name links your account to your existing expenses.
            Leave unselected to join as a new member.
          </p>
        </div>
      )}

      <button
        onClick={handleRequest}
        disabled={busy}
        className="w-full max-w-sm py-3.5 rounded-full bg-[var(--action)] text-white font-medium text-base disabled:opacity-50 active:scale-95 transition-transform"
      >
        {busy
          ? 'Sending…'
          : claimId
            ? `Request to join as ${trip!.members.find((m) => m.id === claimId)?.name}`
            : 'Request to join'}
      </button>

      <button
        onClick={() => onDone(null)}
        className="mt-4 text-[var(--muted)] text-sm active:opacity-60"
      >
        Not now
      </button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-[var(--bg)] p-6 text-center"
      style={{ minHeight: '100dvh' }}
    >
      {children}
    </div>
  )
}
