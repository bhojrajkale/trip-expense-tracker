import { useState, useEffect } from 'react'
import type { Trip, Activity } from '../../types'
import { subscribeActivity } from '../../utils/firestore'
import { formatINR, formatDate } from '../../utils/format'
import { getCategoryConfig } from '../CategoryConfig'

interface Props {
  trip: Trip
  currentUid: string
}

export default function ActivityFeed({ trip, currentUid }: Props) {
  // null = still loading, [] = loaded and empty
  const [activity, setActivity] = useState<Activity[] | null>(null)

  useEffect(() => {
    setActivity(null)
    return subscribeActivity(trip.id, setActivity)
  }, [trip.id])

  if (activity === null) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--muted)] text-sm">
        Loading activity…
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
        <span className="text-5xl mb-3">🕓</span>
        <p className="text-sm">No activity yet.</p>
        <p className="text-xs mt-1">Changes to this trip will show up here.</p>
      </div>
    )
  }

  // Group by calendar day (entries arrive newest first)
  const grouped = activity.reduce<Record<string, Activity[]>>((acc, a) => {
    const day = a.at.slice(0, 10)
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {})

  return (
    <div className="p-4 pb-32 space-y-4">
      {Object.entries(grouped).map(([day, entries]) => (
        <div key={day}>
          <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            {formatDate(day)}
          </div>
          <div className="bg-[var(--surface)] rounded-[18px] border border-[var(--hairline)] overflow-hidden">
            {entries.map((a) => (
              <ActivityRow key={a.id} activity={a} currentUid={currentUid} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityRow({ activity: a, currentUid }: { activity: Activity; currentUid: string }) {
  const actor = a.actorUid === currentUid ? 'You' : a.actorName
  const time = new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const catLabel = () => {
    if (!a.category) return ''
    const cfg = getCategoryConfig(a.category)
    return a.category === 'custom' ? (a.customCategory ?? 'Other') : cfg.label
  }

  let icon: string
  let text: React.ReactNode
  switch (a.type) {
    case 'expense_added':
      icon = '💸'
      text = <><b>{actor}</b> added {catLabel()} · <b>{formatINR(a.amount ?? 0)}</b></>
      break
    case 'expense_updated':
      icon = '✏️'
      text = <><b>{actor}</b> updated {catLabel()} · <b>{formatINR(a.amount ?? 0)}</b></>
      break
    case 'expense_deleted':
      icon = '🗑'
      text = <><b>{actor}</b> deleted {catLabel()} · <b>{formatINR(a.amount ?? 0)}</b></>
      break
    case 'member_added':
      icon = '👤'
      text = <><b>{actor}</b> added <b>{a.memberName}</b></>
      break
    case 'member_removed':
      icon = '👤'
      text = <><b>{actor}</b> removed <b>{a.memberName}</b></>
      break
    case 'member_joined':
      icon = '🎉'
      text = <><b>{actor}</b> joined the trip</>
      break
    case 'member_renamed':
      icon = '✏️'
      text = <><b>{actor}</b> renamed <b>{a.fromName}</b> to <b>{a.toName}</b></>
      break
    case 'settlement_paid':
      icon = '✅'
      text = <><b>{actor}</b> marked <b>{a.fromName} → {a.toName}</b> as paid</>
      break
    case 'settlement_unpaid':
      icon = '↩️'
      text = <><b>{actor}</b> unmarked <b>{a.fromName} → {a.toName}</b></>
      break
    case 'trip_updated':
      icon = '⚙️'
      text = <><b>{actor}</b> updated trip details</>
      break
    default:
      icon = '•'
      text = <><b>{actor}</b> made a change</>
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--divider)] last:border-0">
      <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--ink)] [&>b]:font-semibold">{text}</p>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">{time}</p>
      </div>
    </div>
  )
}
