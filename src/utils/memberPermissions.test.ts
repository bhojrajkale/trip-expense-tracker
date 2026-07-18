import { describe, it, expect } from 'vitest'
import { canRemoveMember } from './memberPermissions'
import type { Member } from '../types'

const owner: Member = { id: 'a', name: 'Owner', uid: 'uid-owner' }
const friend: Member = { id: 'b', name: 'Friend', uid: 'uid-friend' }
const offlineFriend: Member = { id: 'c', name: 'Offline Friend' } // no account linked

describe('canRemoveMember', () => {
  it('the owner CANNOT remove themself', () => {
    expect(canRemoveMember(owner, true, 'uid-owner')).toBe(false)
  })

  it('the owner CAN remove another member', () => {
    expect(canRemoveMember(friend, true, 'uid-owner')).toBe(true)
  })

  it('the owner can remove an offline (no-account) member too', () => {
    expect(canRemoveMember(offlineFriend, true, 'uid-owner')).toBe(true)
  })

  it('a non-owner cannot remove anyone, not even someone else', () => {
    expect(canRemoveMember(friend, false, 'uid-friend')).toBe(false)
  })

  it('a non-owner cannot remove themself either', () => {
    expect(canRemoveMember(friend, false, 'uid-friend')).toBe(false)
  })
})
