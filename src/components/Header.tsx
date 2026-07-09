import { useState } from 'react'
import type { Trip } from '../types'

interface Props {
  activeTrip: Trip | null
  trips: Trip[]
  onSelectTrip: (id: string) => void
  onNewTrip: () => void
  onEditTrip: (trip: Trip) => void
  onDeleteTrip: (id: string) => void
  currentUid: string
  userPhotoURL?: string | null
  onSignOut?: () => void
  isDark: boolean
  onToggleTheme: () => void
}

export default function Header({ activeTrip, trips, onSelectTrip, onNewTrip, onEditTrip, onDeleteTrip, currentUid, userPhotoURL, onSignOut, isDark, onToggleTheme }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleDelete(id: string) {
    onDeleteTrip(id)
    setConfirmDelete(null)
    setShowPicker(false)
  }

  function handleEdit(trip: Trip) {
    onEditTrip(trip)
    setShowPicker(false)
    setConfirmDelete(null)
  }

  return (
    <header
      className="sticky top-0 z-40 bg-[var(--surface-glass)] backdrop-blur-xl border-b border-[var(--hairline)] px-4 py-3"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">✈️</span>
          {activeTrip ? (
            <button
              onClick={() => { setShowPicker(!showPicker); setConfirmDelete(null) }}
              className="flex items-center gap-1 min-w-0"
            >
              <span className="font-semibold text-[var(--ink)] truncate max-w-[180px]" style={{ letterSpacing: '-0.2px' }}>
                {activeTrip.name}
              </span>
              <span className="text-[var(--muted)] text-xs">▾</span>
            </button>
          ) : (
            <span className="font-semibold text-[var(--muted)]">No trip</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="text-base px-2 py-1 rounded-full active:scale-95 transition-transform"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={onNewTrip}
            className="text-[var(--action)] text-sm font-medium py-1.5 px-4 rounded-full border border-[var(--action)] active:scale-95 transition-transform"
          >
            + New Trip
          </button>
          {onSignOut && (
            <button onClick={onSignOut} title="Sign out" className="flex-shrink-0 active:opacity-70">
              {userPhotoURL ? (
                <img src={userPhotoURL} alt="avatar" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--action)] flex items-center justify-center text-white text-xs font-semibold">
                  G
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {showPicker && trips.length > 0 && (
        <div className="mt-2 bg-[var(--surface)] rounded-[18px] overflow-hidden border border-[var(--hairline)]">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className={`flex items-center border-b border-[var(--divider)] last:border-0 transition-colors ${
                trip.id === activeTrip?.id ? 'bg-[var(--action-tint-5)]' : 'hover:bg-[var(--bg)]'
              }`}
            >
              <button
                onClick={() => { onSelectTrip(trip.id); setShowPicker(false); setConfirmDelete(null) }}
                className="flex-1 text-left px-4 py-3 text-sm"
              >
                <div className={`font-medium ${trip.id === activeTrip?.id ? 'text-[var(--action)]' : 'text-[var(--ink)]'}`}>
                  {trip.name}
                </div>
                <div className="text-[var(--muted)] text-xs mt-0.5">{trip.destination}</div>
              </button>

              {trip.ownerUid !== currentUid ? (
                <span className="text-[10px] text-[var(--muted)] px-3 py-3">shared</span>
              ) : confirmDelete === trip.id ? (
                <div className="flex items-center gap-1 pr-2">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs text-[var(--muted)] px-2 py-1 rounded-lg border border-[var(--hairline)]"
                  >
                    No
                  </button>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="text-xs text-[var(--red)] px-2 py-1 rounded-lg border border-[var(--red-border)]"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex items-center pr-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(trip) }}
                    className="text-[var(--action)] px-2.5 py-3 text-sm transition-opacity active:opacity-50"
                    title="Edit trip"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(trip.id) }}
                    className="text-[var(--disabled)] hover:text-[var(--red)] px-2.5 py-3 text-base transition-colors"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
