import { describe, it, expect } from 'vitest'
import { memberUidsFor, cleanTrip, buildPreview, clean } from './firestore'
import type { Trip } from '../types'

function trip(partial: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Goa Trip',
    destination: 'Goa',
    startDate: '2026-01-01',
    budget: 1000,
    members: [
      { id: 'a', name: 'Alice', uid: 'uid-a', email: 'alice@example.com', photoURL: 'http://x/a.png' },
      { id: 'b', name: 'Bob' }, // offline member, no account linked
    ],
    ownerUid: 'uid-owner',
    memberUids: [],
    ...partial,
  }
}

describe('memberUidsFor', () => {
  it('always includes the owner', () => {
    const uids = memberUidsFor({ ownerUid: 'uid-owner', members: [] })
    expect(uids).toContain('uid-owner')
  })

  it('includes every member who has a linked account', () => {
    const uids = memberUidsFor(trip())
    expect(uids).toContain('uid-a')
  })

  it('does not include offline members (no uid) as their own entry', () => {
    const uids = memberUidsFor(trip())
    // Bob has no uid, so nothing named after Bob should appear
    expect(uids).toEqual(['uid-owner', 'uid-a'])
  })

  it('never lists the same uid twice, even if the owner is also a member', () => {
    const uids = memberUidsFor({
      ownerUid: 'uid-owner',
      members: [{ id: 'a', name: 'Owner', uid: 'uid-owner' }],
    })
    expect(uids).toEqual(['uid-owner'])
  })
})

describe('clean', () => {
  it('strips out fields that are undefined', () => {
    const result = clean({ a: 1, b: undefined, c: 'x' })
    expect(result).toEqual({ a: 1, c: 'x' })
  })

  it('keeps falsy-but-defined values like 0, "", and false', () => {
    const result = clean({ a: 0, b: '', c: false })
    expect(result).toEqual({ a: 0, b: '', c: false })
  })
})

describe('cleanTrip', () => {
  it('recomputes memberUids from the current members list rather than trusting the input', () => {
    // Even if memberUids was stale/wrong going in, cleanTrip must fix it —
    // this is what every save relies on to keep access control correct.
    const stale = trip({ memberUids: ['someone-unrelated'] })
    const result = cleanTrip(stale)
    expect(result.memberUids).toEqual(['uid-owner', 'uid-a'])
  })

  it('keeps all other trip fields intact', () => {
    const result = cleanTrip(trip({ archived: true, budget: 5000 }))
    expect(result.archived).toBe(true)
    expect(result.budget).toBe(5000)
    expect(result.name).toBe('Goa Trip')
  })
})

describe('buildPreview', () => {
  it('never includes email or photoURL for any member', () => {
    const preview = buildPreview(trip())
    const json = JSON.stringify(preview)
    expect(json).not.toContain('alice@example.com')
    expect(json).not.toContain('x/a.png')
  })

  it('never includes the trip budget', () => {
    const preview = buildPreview(trip({ budget: 99999 }))
    expect(JSON.stringify(preview)).not.toContain('99999')
  })

  it('still includes what the invite screen needs: name, destination, dates, and member names', () => {
    const preview = buildPreview(trip())
    expect(preview.name).toBe('Goa Trip')
    expect(preview.destination).toBe('Goa')
    expect(preview.members.map((m) => m.name)).toEqual(['Alice', 'Bob'])
  })
})
