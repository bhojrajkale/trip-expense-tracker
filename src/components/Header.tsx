import { useState } from 'react'
import type { Trip } from '../types'

interface Props {
  activeTrip: Trip | null
  trips: Trip[]
  onSelectTrip: (id: string) => void
  onNewTrip: () => void
  userPhotoURL?: string | null
  onSignOut?: () => void
}

export default function Header({ activeTrip, trips, onSelectTrip, onNewTrip, userPhotoURL, onSignOut }: Props) {
  const [showPicker, setShowPicker] = useState(false)

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
              onClick={() => setShowPicker(!showPicker)}
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
            <button
              key={trip.id}
              onClick={() => {
                onSelectTrip(trip.id)
                setShowPicker(false)
              }}
              className={`w-full text-left px-4 py-3 text-sm border-b border-slate-700 last:border-0 transition-colors ${
                trip.id === activeTrip?.id
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              <div className="font-medium">{trip.name}</div>
              <div className="text-slate-400 text-xs">{trip.destination}</div>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
