import { useState } from 'react'
import type { Member, Trip, Expense, JoinRequest } from '../../types'
import { isContactsSupported, pickContacts } from '../../utils/contacts'
import { initials, formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements, computeRawDebts } from '../../utils/settlement'
import { shareOrCopy } from '../../utils/share'
import InviteModal from './InviteModal'

interface Props {
  trip: Trip
  expenses: Expense[]
  currentUid: string
  isOwner: boolean
  joinRequests: JoinRequest[]
  onAddMember: (member: Member) => void
  onAddMembers: (members: Member[]) => void
  onRemoveMember: (memberId: string) => void
  onToggleSettlementPaid: (from: string, to: string) => void
  onApproveRequest: (req: JoinRequest) => void
  onRejectRequest: (reqUid: string) => void
}

export default function PeopleTab({ trip, expenses, currentUid, isOwner, joinRequests, onAddMember, onAddMembers, onRemoveMember, onToggleSettlementPaid, onApproveRequest, onRejectRequest }: Props) {
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [contactsError, setContactsError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [simplified, setSimplified] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [toast, setToast] = useState('')

  const balances = computeBalances(expenses, trip.members)
  const settlements = simplified
    ? minimizeSettlements(balances)
    : computeRawDebts(expenses)

  const paidSettlements = trip.paidSettlements ?? []
  const isPaid = (from: string, to: string) =>
    paidSettlements.some((p) => p.from === from && p.to === to)

  const unpaidCount = settlements.filter((s) => !isPaid(s.from, s.to)).length
  const allPaid = settlements.length > 0 && unpaidCount === 0

  async function handlePickContacts() {
    setContactsError('')
    try {
      const picked = await pickContacts()
      const fresh = picked.filter(
        (m) => !trip.members.some((existing) => existing.name.toLowerCase() === m.name.toLowerCase())
      )
      if (fresh.length > 0) onAddMembers(fresh)
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

  async function handleShareSettlement(from: string, to: string, amount: number) {
    const text = `Hey ${memberName(from)}, just a reminder — you owe ${memberName(to)} ${formatINR(amount)} for ${trip.name}.\n\nPlease transfer when you get a chance! 🙏`
    const result = await shareOrCopy(`Payment reminder · ${trip.name}`, text)
    setToast(result === 'shared' ? 'Shared!' : 'Copied to clipboard!')
    setTimeout(() => setToast(''), 2500)
  }

  const AVATAR_COLORS = [
    '#0066cc', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  ]

  return (
    <div className="p-4 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.2px' }}>
          Members ({trip.members.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-2 rounded-full bg-[var(--action)] text-white text-sm font-medium active:scale-95 transition-transform"
          >
            + Invite
          </button>
          {isContactsSupported() && (
            <button
              onClick={handlePickContacts}
              className="px-3 py-2 rounded-full bg-[var(--action-tint)] text-[var(--action)] text-sm font-medium border border-[var(--action-border-sub)] active:scale-95 transition-transform"
            >
              + Contacts
            </button>
          )}
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-3 py-2 rounded-full bg-[var(--surface)] text-[var(--ink)] text-sm font-medium border border-[var(--hairline)] active:scale-95 transition-transform"
          >
            + Manual
          </button>
        </div>
      </div>

      {contactsError && (
        <p className="text-[var(--orange)] text-sm bg-[var(--orange-tint)] rounded-[11px] p-3">{contactsError}</p>
      )}

      {showManual && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[var(--surface)] border border-[var(--hairline)] rounded-[11px] px-4 py-3 text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--action)] text-sm"
            placeholder="Person's name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            autoFocus
            maxLength={50}
          />
          <button
            onClick={handleManualAdd}
            className="px-4 py-3 rounded-[11px] bg-[var(--action)] text-white text-sm font-medium active:scale-95 transition-transform"
          >
            Add
          </button>
        </div>
      )}

      {isOwner && joinRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
            Requests to join ({joinRequests.length})
          </h3>
          <div className="space-y-2">
            {joinRequests.map((req) => {
              const claimName = req.claimMemberId
                ? trip.members.find((m) => m.id === req.claimMemberId)?.name
                : null
              return (
                <div
                  key={req.uid}
                  className="flex items-center gap-3 p-3 rounded-[18px] border border-[var(--action-border)] bg-[var(--action-tint)]"
                >
                  {req.photoURL ? (
                    <img src={req.photoURL} alt={req.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--action)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {initials(req.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--ink)] truncate">{req.name}</div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {claimName ? `wants to join as ${claimName}` : 'wants to join'}
                    </div>
                  </div>
                  <button
                    onClick={() => onRejectRequest(req.uid)}
                    className="text-xs font-medium text-[var(--muted)] px-3 py-1.5 rounded-full border border-[var(--hairline)] active:scale-95 transition-transform"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => onApproveRequest(req)}
                    className="text-xs font-medium text-white px-3 py-1.5 rounded-full bg-[var(--action)] active:scale-95 transition-transform"
                  >
                    Approve
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {trip.members.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-[var(--muted)]">
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
                className="bg-[var(--surface)] rounded-[18px] border border-[var(--hairline)] overflow-hidden"
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
                    <div className="text-sm font-medium text-[var(--ink)] truncate">
                      {member.name}
                      {member.uid === currentUid && <span className="text-[var(--muted)] font-normal"> (you)</span>}
                    </div>
                    {member.uid ? (
                      <div className="text-xs text-[var(--action)]">● linked account</div>
                    ) : member.phone ? (
                      <div className="text-xs text-[var(--muted)]">{member.phone}</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        bal > 0 ? 'text-[var(--green)]' : bal < 0 ? 'text-[var(--red)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {bal > 0 ? '+' : ''}{formatINR(Math.round(bal))}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">
                      {bal > 0 ? 'gets back' : bal < 0 ? 'owes' : 'settled'}
                    </div>
                  </div>
                  {!isOwner ? null : isConfirming ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="text-xs text-[var(--muted)] px-2 py-1 rounded-lg border border-[var(--hairline)]"
                      >
                        No
                      </button>
                      <button
                        onClick={() => {
                          onRemoveMember(member.id)
                          setConfirmRemove(null)
                        }}
                        className="text-xs text-[var(--red)] px-2 py-1 rounded-lg border border-[var(--red-border)]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(member.id)}
                      className="text-[var(--disabled)] text-lg px-1 active:opacity-50"
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
            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
              Who pays whom
            </h3>
            <div className="flex bg-[var(--bg)] rounded-lg overflow-hidden border border-[var(--hairline)]">
              {(['Simplified', 'Original'] as const).map((mode) => {
                const isActive = mode === 'Simplified' ? simplified : !simplified
                return (
                  <button
                    key={mode}
                    onClick={() => setSimplified(mode === 'Simplified')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      isActive ? 'bg-[var(--action)] text-white rounded-lg' : 'text-[var(--muted)]'
                    }`}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
          </div>

          {settlements.length === 0 || allPaid ? (
            <div className="flex items-center gap-2 bg-[var(--green-tint)] border border-[var(--green-border)] rounded-[18px] p-4">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-[var(--green)] font-medium">All settled up!</p>
            </div>
          ) : null}

          {settlements.length > 0 && (
            <div className="space-y-2">
              {settlements.map((s, i) => {
                const paid = isPaid(s.from, s.to)
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-[18px] p-3 border transition-colors ${
                      paid
                        ? 'bg-[var(--green-tint)] border-[var(--green-border)]'
                        : 'bg-[var(--surface)] border-[var(--hairline)]'
                    }`}
                  >
                    <div className={`flex-1 text-sm min-w-0 ${paid ? 'line-through opacity-50' : 'text-[var(--ink)]'}`}>
                      <span className={paid ? 'text-[var(--muted)]' : 'text-[var(--red)] font-medium'}>{memberName(s.from)}</span>
                      <span className="text-[var(--muted)] mx-2">pays</span>
                      <span className={paid ? 'text-[var(--muted)]' : 'text-[var(--green)] font-medium'}>{memberName(s.to)}</span>
                    </div>
                    <span className={`text-sm flex-shrink-0 font-semibold ${paid ? 'text-[var(--green)] line-through opacity-50' : 'text-[var(--ink)]'}`}>
                      {formatINR(s.amount)}
                    </span>
                    {(() => {
                      const receiverUid = trip.members.find((m) => m.id === s.to)?.uid
                      const canMark = isOwner || (!!receiverUid && receiverUid === currentUid)
                      return (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!paid && (
                            <button
                              onClick={() => handleShareSettlement(s.from, s.to, s.amount)}
                              className="text-[var(--action)] text-base px-1.5 py-1 rounded-full active:opacity-50 transition-opacity"
                              title="Send reminder"
                            >
                              💬
                            </button>
                          )}
                          {canMark && (
                            <button
                              onClick={() => onToggleSettlementPaid(s.from, s.to)}
                              className={`text-xs font-medium px-2.5 py-1.5 rounded-full border active:scale-95 transition-transform ${
                                paid
                                  ? 'text-[var(--muted)] border-[var(--hairline)] bg-[var(--surface)]'
                                  : 'text-[var(--green)] border-[var(--green-border)] bg-[var(--green-tint)]'
                              }`}
                            >
                              {paid ? 'Undo' : '✓ Paid'}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          {!simplified && (
            <p className="text-[10px] text-[var(--muted)] mt-2 text-center">
              Original debts per expense pair · not minimized
            </p>
          )}
        </div>
      )}

      {showInvite && <InviteModal trip={trip} onClose={() => setShowInvite(false)} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--bg)] text-sm font-medium px-4 py-2.5 rounded-full shadow-lg z-[200] whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
