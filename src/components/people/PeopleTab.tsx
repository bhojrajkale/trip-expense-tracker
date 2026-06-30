import { useState } from 'react'
import type { Member, Trip, Expense } from '../../types'
import { isContactsSupported, pickContacts } from '../../utils/contacts'
import { initials, formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements, computeRawDebts } from '../../utils/settlement'

interface Props {
  trip: Trip
  expenses: Expense[]
  onAddMember: (member: Member) => void
  onRemoveMember: (memberId: string) => void
}

export default function PeopleTab({ trip, expenses, onAddMember, onRemoveMember }: Props) {
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [contactsError, setContactsError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [simplified, setSimplified] = useState(true)

  const balances = computeBalances(expenses, trip.members)
  const settlements = simplified
    ? minimizeSettlements(balances)
    : computeRawDebts(expenses)

  async function handlePickContacts() {
    setContactsError('')
    try {
      const members = await pickContacts()
      if (members.length === 0) return
      for (const m of members) {
        const exists = trip.members.some(
          (existing) => existing.name.toLowerCase() === m.name.toLowerCase()
        )
        if (!exists) onAddMember(m)
      }
    } catch {
      setContactsError('Could not access contacts. Add manually instead.')
    }
  }

  function handleManualAdd() {
    const trimmed = manualName.trim().slice(0, 50)
    if (!trimmed) return
    const exists = trip.members.some(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (!exists) {
      onAddMember({ id: crypto.randomUUID(), name: trimmed })
    }
    setManualName('')
    setShowManual(false)
  }

  const memberName = (id: string) =>
    trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  const AVATAR_COLORS = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6',
  ]

  return (
    <div className="p-4 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Members ({trip.members.length})</h2>
        <div className="flex gap-2">
          {isContactsSupported() && (
            <button
              onClick={handlePickContacts}
              className="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/30"
            >
              + Contacts
            </button>
          )}
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-3 py-2 rounded-xl bg-slate-700 text-slate-200 text-sm font-medium border border-slate-600"
          >
            + Manual
          </button>
        </div>
      </div>

      {contactsError && (
        <p className="text-amber-400 text-sm bg-amber-400/10 rounded-xl p-3">{contactsError}</p>
      )}

      {showManual && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
            placeholder="Person's name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            autoFocus
            maxLength={50}
          />
          <button
            onClick={handleManualAdd}
            className="px-4 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium"
          >
            Add
          </button>
        </div>
      )}

      {trip.members.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-500">
          <span className="text-5xl mb-3">👥</span>
          <p className="text-sm">No members yet.</p>
          <p className="text-xs mt-1">Add from Contacts or manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trip.members.map((member, idx) => {
            const bal = balances.get(member.id) ?? 0
            const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
            const isConfirming = confirmRemove === member.id
            return (
              <div
                key={member.id}
                className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {initials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{member.name}</div>
                    {member.phone && (
                      <div className="text-xs text-slate-500">{member.phone}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        bal > 0 ? 'text-green-400' : bal < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}
                    >
                      {bal > 0 ? '+' : ''}{formatINR(Math.round(bal))}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {bal > 0 ? 'gets back' : bal < 0 ? 'owes' : 'settled'}
                    </div>
                  </div>
                  {isConfirming ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="text-xs text-slate-400 px-2 py-1 rounded-lg border border-slate-600"
                      >
                        No
                      </button>
                      <button
                        onClick={() => {
                          onRemoveMember(member.id)
                          setConfirmRemove(null)
                        }}
                        className="text-xs text-red-400 px-2 py-1 rounded-lg border border-red-500/30"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(member.id)}
                      className="text-slate-600 text-lg px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(settlements.length > 0 || (expenses.length > 0 && trip.members.length > 0)) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Who pays whom
            </h3>
            <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              {(['Simplified', 'Original'] as const).map((mode) => {
                const isActive = mode === 'Simplified' ? simplified : !simplified
                return (
                  <button
                    key={mode}
                    onClick={() => setSimplified(mode === 'Simplified')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      isActive ? 'bg-indigo-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
          </div>

          {settlements.length === 0 ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-green-400 font-medium">All settled up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-slate-800 rounded-2xl p-3 border border-slate-700"
                >
                  <div className="flex-1 text-sm text-white min-w-0">
                    <span className="text-red-400 font-medium">{memberName(s.from)}</span>
                    <span className="text-slate-400 mx-2">pays</span>
                    <span className="text-green-400 font-medium">{memberName(s.to)}</span>
                  </div>
                  <span className="text-white font-bold text-sm flex-shrink-0">{formatINR(s.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {!simplified && (
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              Original debts per expense pair · not minimized
            </p>
          )}
        </div>
      )}

    </div>
  )
}
