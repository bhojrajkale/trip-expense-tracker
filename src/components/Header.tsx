import { useState } from 'react'
import type { Trip } from '../types'

interface Props {
  activeTrip: Trip | null
  trips: Trip[]
  onSelectTrip: (id: string) => void
  onNewTrip: () => void
  canCreateTrip: boolean
  onEditTrip: (trip: Trip) => void
  onDuplicateTrip: (trip: Trip) => void
  onArchiveTrip: (id: string) => void
  onDeleteTrip: (id: string) => void
  currentUid: string
  userPhotoURL?: string | null
  onSignOut?: () => void
  isDark: boolean
  onToggleTheme: () => void
}

export default function Header({ activeTrip, trips, onSelectTrip, onNewTrip, canCreateTrip, onEditTrip, onDuplicateTrip, onArchiveTrip, onDeleteTrip, currentUid, userPhotoURL, onSignOut, isDark, onToggleTheme }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Same fallback as PeopleTab's member avatars: a stale/broken Google photo
  // URL must not render the browser's broken-image glyph in its place.
  const [photoBroken, setPhotoBroken] = useState(false)

  const currentTrips = trips.filter((t) => !t.archived)
  const archivedTrips = trips.filter((t) => t.archived)

  function togglePicker() {
    setShowPicker(!showPicker)
    setShowArchived(false)
    setConfirmDelete(null)
  }

  function handleSelect(id: string) {
    onSelectTrip(id)
    setShowPicker(false)
    setConfirmDelete(null)
  }

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

  function handleDuplicate(trip: Trip) {
    onDuplicateTrip(trip)
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
            <button onClick={togglePicker} className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-[var(--ink)] truncate max-w-[180px]" style={{ letterSpacing: '-0.2px' }}>
                {activeTrip.name}
              </span>
              <span className="text-[var(--muted)] text-xs">▾</span>
            </button>
          ) : trips.length > 0 ? (
            // All trips archived — the picker is still the way back to them
            <button onClick={togglePicker} className="flex items-center gap-1">
              <span className="font-semibold text-[var(--muted)]">No trip</span>
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
          {canCreateTrip && (
            <button
              onClick={onNewTrip}
              className="text-[var(--action)] text-sm font-medium py-1.5 px-4 rounded-full border border-[var(--action)] active:scale-95 transition-transform"
            >
              + New Trip
            </button>
          )}
          {onSignOut && (
            <button onClick={onSignOut} title="Sign out" className="flex-shrink-0 active:opacity-70">
              {userPhotoURL && !photoBroken ? (
                <img
                  src={userPhotoURL}
                  alt="avatar"
                  onError={() => setPhotoBroken(true)}
                  className="w-7 h-7 rounded-full"
                />
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
          {currentTrips.map((trip) => (
            <div
              key={trip.id}
              className={`flex items-center border-b border-[var(--divider)] last:border-0 transition-colors ${
                trip.id === activeTrip?.id ? 'bg-[var(--action-tint-5)]' : 'hover:bg-[var(--bg)]'
              }`}
            >
              <button
                onClick={() => handleSelect(trip.id)}
                className="flex-1 text-left px-4 py-3 text-sm min-w-0"
              >
                <div className={`font-medium truncate ${trip.id === activeTrip?.id ? 'text-[var(--action)]' : 'text-[var(--ink)]'}`}>
                  {trip.name}
                </div>
                <div className="text-[var(--muted)] text-xs mt-0.5 truncate">{trip.destination}</div>
              </button>

              {confirmDelete === trip.id ? (
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
              ) : trip.ownerUid === currentUid ? (
                <div className="flex items-center pr-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(trip) }}
                    className="text-[var(--action)] px-2 py-3 text-sm transition-opacity active:opacity-50"
                    title="Edit trip"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(trip) }}
                    className="text-[var(--action)] px-2 py-3 text-xl leading-none transition-opacity active:opacity-50"
                    title="Duplicate trip"
                  >
                    ⧉
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchiveTrip(trip.id) }}
                    className="text-[var(--action)] px-2 py-3 text-sm transition-opacity active:opacity-50"
                    title="Archive trip"
                  >
                    📦
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(trip.id) }}
                    className="text-[var(--disabled)] hover:text-[var(--red)] px-2 py-3 text-base transition-colors"
                    title="Delete trip"
                  >
                    🗑
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-[var(--muted)] px-2 py-3">shared</span>
              )}
            </div>
          ))}

          {currentTrips.length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--muted)]">
              All trips archived.
            </div>
          )}

          {archivedTrips.length > 0 && (
            <>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[var(--divider)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider"
              >
                <span>Archived ({archivedTrips.length})</span>
                <span>{showArchived ? '▴' : '▾'}</span>
              </button>

              {showArchived && archivedTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center border-t border-[var(--divider)] opacity-80"
                >
                  <button
                    onClick={() => handleSelect(trip.id)}
                    className="flex-1 text-left px-4 py-3 text-sm min-w-0"
                  >
                    <div className="font-medium text-[var(--muted)] truncate">{trip.name}</div>
                    <div className="text-[var(--muted)] text-xs mt-0.5 truncate">{trip.destination}</div>
                  </button>

                  {confirmDelete === trip.id ? (
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
                  ) : trip.ownerUid === currentUid ? (
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        onClick={() => onArchiveTrip(trip.id)}
                        className="text-xs text-[var(--action)] font-medium px-2.5 py-1 rounded-full border border-[var(--action-border)] active:scale-95 transition-transform"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => setConfirmDelete(trip.id)}
                        className="text-[var(--disabled)] hover:text-[var(--red)] px-1.5 py-3 text-base transition-colors"
                        title="Delete trip"
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--muted)] px-2.5 py-3">shared</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </header>
  )
}
