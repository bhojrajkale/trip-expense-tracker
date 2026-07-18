import type { Member } from '../types'

// The owner can remove any member except themself — self-removal wouldn't
// even revoke access (memberUidsFor() always keeps ownerUid in memberUids),
// it would just strand the trip with an owner who has no member card. This
// is deliberately its own named, tested function rather than an inline JSX
// check: it's the one guard in the app where a silent regression could lock
// someone out of their own trip.
export function canRemoveMember(member: Member, isOwner: boolean, currentUid: string): boolean {
  return isOwner && member.uid !== currentUid
}
