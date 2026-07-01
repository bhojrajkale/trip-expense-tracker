import { useState } from 'react'
import type { Trip } from '../types'

interface Props {
  activeTrip: Trip | null
  trips: Trip[]
  onSelectTrip: (id: string) => void
  onNewTrip: () => void
  onDeleteTrip: (id: string) => void
  userPhotoURL?: string | null
  onSignOut?: () => void
}

export default function Header({ activeTrip, trips, onSelectTrip, onNewTrip, onDeleteTrip, userPhotoURL, onSignOut }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleDelete(id: string) {
    onDeleteTrip(id)
    setConfirmDelete(null)
    setShowPicker(false)
  }

  return (
    <header
      className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3"
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
              <span className="font-semibold text-white truncate max-w-[180px]">
                {activeTrip.name}
              </span>
              <span className="text-slate-400 text-sm">▾</span>
            </button>
          ) : (
            <span className="font-semibold text-slate-400">No trip</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewTrip}
            className="text-indigo-400 text-sm font-medium py-1 px-3 rounded-full border border-indigo-500/40 hover:bg-indigo-500/10 transition-colors"
          >
            + New Trip
          </button>
          {onSignOut && (
            <button onClick={onSignOut} title="Sign out" className="flex-shrink-0">
              {userPhotoURL ? (
                <img src={userPhotoURL} alt="avatar" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                  G
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {showPicker && trips.length > 0 && (
        <div className="mt-2 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className={`flex items-center border-b border-slate-700 last:border-0 transition-colors ${
                trip.id === activeTrip?.id ? 'bg-indigo-500/20' : 'hover:bg-slate-700'
              }`}
            >
              <button
                onClick={() => { onSelectTrip(trip.id); setShowPicker(false); setConfirmDelete(null) }}
                className="flex-1 text-left px-4 py-3 text-sm"
              >
                <div className={`font-medium ${trip.id === activeTrip?.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {trip.name}
                </div>
                <div className="text-slate-400 text-xs">{trip.destination}</div>
              </button>

              {confirmDelete === trip.id ? (
                <div className="flex items-center gap-1 pr-2">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs text-slate-400 px-2 py-1 rounded-lg border border-slate-600"
                  >
                    No
                  </button>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="text-xs text-red-400 px-2 py-1 rounded-lg border border-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(trip.id) }}
                  className="text-slate-600 hover:text-red-400 px-3 py-3 text-base transition-colors"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
