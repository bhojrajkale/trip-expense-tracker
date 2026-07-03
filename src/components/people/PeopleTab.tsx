import { useState } from 'react'
import type { Member, Trip, Expense } from '../../types'
import { isContactsSupported, pickContacts } from '../../utils/contacts'
import { initials, formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements, computeRawDebts } from '../../utils/settlement'
import InviteModal from './InviteModal'

interface Props {
  trip: Trip
  expenses: Expense[]
  currentUid: string
  isOwner: boolean
  onAddMember: (member: Member) => void
  onRemoveMember: (memberId: string) => void
}

export default function PeopleTab({ trip, expenses, currentUid, isOwner, onAddMember, onRemoveMember }: Props) {
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [contactsError, setContactsError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [simplified, setSimplified] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

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
    '#0066cc', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  ]

  return (
    <div className="p-4 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#1d1d1f]" style={{ letterSpacing: '-0.2px' }}>
          Members ({trip.members.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-2 rounded-full bg-[#0066cc] text-white text-sm font-medium active:scale-95 transition-transform"
          >
            + Invite
          </button>
          {isContactsSupported() && (
            <button
              onClick={handlePickContacts}
              className="px-3 py-2 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-sm font-medium border border-[#0066cc]/20 active:scale-95 transition-transform"
            >
              + Contacts
            </button>
          )}
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-3 py-2 rounded-full bg-white text-[#1d1d1f] text-sm font-medium border border-[#e0e0e0] active:scale-95 transition-transform"
          >
            + Manual
          </button>
        </div>
      </div>

      {contactsError && (
        <p className="text-[#ff9500] text-sm bg-[#ff9500]/10 rounded-[11px] p-3">{contactsError}</p>
      )}

      {showManual && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-white border border-[#e0e0e0] rounded-[11px] px-4 py-3 text-[#1d1d1f] placeholder-[#7a7a7a] focus:outline-none focus:border-[#0066cc] text-sm"
            placeholder="Person's name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            autoFocus
            maxLength={50}
          />
          <button
            onClick={handleManualAdd}
            className="px-4 py-3 rounded-[11px] bg-[#0066cc] text-white text-sm font-medium active:scale-95 transition-transform"
          >
            Add
          </button>
        </div>
      )}

      {trip.members.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-[#7a7a7a]">
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
                className="bg-white rounded-[18px] border border-[#e0e0e0] overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  {member.photoURL ? (
                    <img
                      src={member.photoURL}
                      alt={member.name}
                      className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials(member.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1d1d1f] truncate">
                      {member.name}
                      {member.uid === currentUid && <span className="text-[#7a7a7a] font-normal"> (you)</span>}
                    </div>
                    {member.uid ? (
                      <div className="text-xs text-[#0066cc]">● linked account</div>
                    ) : member.phone ? (
                      <div className="text-xs text-[#7a7a7a]">{member.phone}</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        bal > 0 ? 'text-green-600' : bal < 0 ? 'text-red-500' : 'text-[#7a7a7a]'
                      }`}
                    >
                      {bal > 0 ? '+' : ''}{formatINR(Math.round(bal))}
                    </div>
                    <div className="text-[10px] text-[#7a7a7a]">
                      {bal > 0 ? 'gets back' : bal < 0 ? 'owes' : 'settled'}
                    </div>
                  </div>
                  {!isOwner ? null : isConfirming ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="text-xs text-[#7a7a7a] px-2 py-1 rounded-lg border border-[#e0e0e0]"
                      >
                        No
                      </button>
                      <button
                        onClick={() => {
                          onRemoveMember(member.id)
                          setConfirmRemove(null)
                        }}
                        className="text-xs text-red-500 px-2 py-1 rounded-lg border border-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(member.id)}
                      className="text-[#cccccc] text-lg px-1 active:opacity-50"
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
            <h3 className="text-sm font-semibold text-[#7a7a7a] uppercase tracking-wider">
              Who pays whom
            </h3>
            <div className="flex bg-[#f5f5f7] rounded-lg overflow-hidden border border-[#e0e0e0]">
              {(['Simplified', 'Original'] as const).map((mode) => {
                const isActive = mode === 'Simplified' ? simplified : !simplified
                return (
                  <button
                    key={mode}
                    onClick={() => setSimplified(mode === 'Simplified')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      isActive ? 'bg-[#0066cc] text-white rounded-lg' : 'text-[#7a7a7a]'
                    }`}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
          </div>

          {settlements.length === 0 ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-[18px] p-4">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-green-600 font-medium">All settled up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white rounded-[18px] p-3 border border-[#e0e0e0]"
                >
                  <div className="flex-1 text-sm text-[#1d1d1f] min-w-0">
                    <span className="text-red-500 font-medium">{memberName(s.from)}</span>
                    <span className="text-[#7a7a7a] mx-2">pays</span>
                    <span className="text-green-600 font-medium">{memberName(s.to)}</span>
                  </div>
                  <span className="text-[#1d1d1f] font-semibold text-sm flex-shrink-0">{formatINR(s.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {!simplified && (
            <p className="text-[10px] text-[#7a7a7a] mt-2 text-center">
              Original debts per expense pair · not minimized
            </p>
          )}
        </div>
      )}

      {showInvite && <InviteModal trip={trip} onClose={() => setShowInvite(false)} />}
    </div>
  )
}
