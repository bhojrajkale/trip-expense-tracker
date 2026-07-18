import { describe, it, expect } from 'vitest'
import { reducer, mergeApprovedMember, type State } from './useStore'
import type { Trip, Expense, Member, JoinRequest } from '../types'

function trip(partial: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Goa Trip',
    destination: 'Goa',
    startDate: '2026-01-01',
    budget: 1000,
    members: [{ id: 'a', name: 'Alice' }],
    ownerUid: 'u1',
    memberUids: ['u1'],
    ...partial,
  }
}

function expense(partial: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    tripId: 't1',
    createdByUid: 'u1',
    amount: 100,
    category: 'food',
    paidBy: 'a',
    splitBetween: ['a'],
    date: '2026-01-01',
    notes: '',
    ...partial,
  }
}

const emptyState: State = { trips: [], expenses: [], activeTripId: null }

describe('reducer — trip list bookkeeping', () => {
  it('adding a trip puts it in the list', () => {
    const state = reducer(emptyState, { type: 'ADD_TRIP', trip: trip() })
    expect(state.trips).toHaveLength(1)
    expect(state.trips[0].id).toBe('t1')
  })

  it('updating a trip replaces the old version, does not duplicate it', () => {
    const state = reducer(
      { ...emptyState, trips: [trip()] },
      { type: 'UPDATE_TRIP', trip: trip({ name: 'Renamed' }) }
    )
    expect(state.trips).toHaveLength(1)
    expect(state.trips[0].name).toBe('Renamed')
  })

  it('deleting the trip you are currently viewing switches you to another trip, not a blank screen', () => {
    const state: State = {
      trips: [trip({ id: 't1' }), trip({ id: 't2' })],
      expenses: [],
      activeTripId: 't1',
    }
    const result = reducer(state, { type: 'DELETE_TRIP', id: 't1' })
    expect(result.trips.map((t) => t.id)).toEqual(['t2'])
    expect(result.activeTripId).toBe('t2')
  })

  it('deleting a trip that is not the active one leaves the active trip untouched', () => {
    const state: State = {
      trips: [trip({ id: 't1' }), trip({ id: 't2' })],
      expenses: [],
      activeTripId: 't2',
    }
    const result = reducer(state, { type: 'DELETE_TRIP', id: 't1' })
    expect(result.activeTripId).toBe('t2')
  })

  it('deleting the last remaining trip leaves you with no active trip, not a crash', () => {
    const state: State = { trips: [trip({ id: 't1' })], expenses: [], activeTripId: 't1' }
    const result = reducer(state, { type: 'DELETE_TRIP', id: 't1' })
    expect(result.trips).toEqual([])
    expect(result.activeTripId).toBeNull()
  })

  it('deleting a trip also removes its expenses, not just the trip itself', () => {
    const state: State = {
      trips: [trip({ id: 't1' }), trip({ id: 't2' })],
      expenses: [expense({ tripId: 't1' }), expense({ id: 'e2', tripId: 't2' })],
      activeTripId: 't1',
    }
    const result = reducer(state, { type: 'DELETE_TRIP', id: 't1' })
    expect(result.expenses.map((e) => e.tripId)).toEqual(['t2'])
  })

  it('removing a member updates that trip, leaves other trips alone', () => {
    const state: State = {
      trips: [
        trip({ id: 't1', members: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }] }),
        trip({ id: 't2', members: [{ id: 'a', name: 'Alice' }] }),
      ],
      expenses: [],
      activeTripId: 't1',
    }
    const result = reducer(state, { type: 'REMOVE_MEMBER', tripId: 't1', memberId: 'b' })
    expect(result.trips[0].members.map((m) => m.id)).toEqual(['a'])
    expect(result.trips[1].members).toHaveLength(1) // t2 untouched
  })
})

describe('reducer — expense bookkeeping', () => {
  it('adding an expense puts it in the list', () => {
    const state = reducer(emptyState, { type: 'ADD_EXPENSE', expense: expense() })
    expect(state.expenses).toHaveLength(1)
  })

  it('updating an expense replaces the old version, does not duplicate it', () => {
    const state = reducer(
      { ...emptyState, expenses: [expense()] },
      { type: 'UPDATE_EXPENSE', expense: expense({ amount: 500 }) }
    )
    expect(state.expenses).toHaveLength(1)
    expect(state.expenses[0].amount).toBe(500)
  })

  it('deleting an expense removes only that one', () => {
    const state = reducer(
      { ...emptyState, expenses: [expense({ id: 'e1' }), expense({ id: 'e2' })] },
      { type: 'DELETE_EXPENSE', id: 'e1' }
    )
    expect(state.expenses.map((e) => e.id)).toEqual(['e2'])
  })
})

describe('mergeApprovedMember — approving a join request', () => {
  const offlineMembers: Member[] = [
    { id: 'a', name: 'Alice', uid: 'uid-alice' },
    { id: 'b', name: 'Bob' }, // offline placeholder, not linked to any account
  ]

  function request(partial: Partial<JoinRequest> = {}): JoinRequest {
    return {
      uid: 'uid-newperson',
      name: 'Newperson',
      email: null,
      photoURL: null,
      requestedAt: '2026-01-01T00:00:00.000Z',
      ...partial,
    }
  }

  it('a brand-new person joining gets added as a new member', () => {
    const result = mergeApprovedMember(offlineMembers, request())
    expect(result.changed).toBe(true)
    expect(result.conflict).toBe(false)
    expect(result.members.map((m) => m.name)).toContain('Newperson')
    expect(result.members.some((m) => m.uid === 'uid-newperson')).toBe(true)
  })

  it('claiming an offline placeholder member links the account to that member', () => {
    const result = mergeApprovedMember(offlineMembers, request({ claimMemberId: 'b' }))
    expect(result.changed).toBe(true)
    expect(result.conflict).toBe(false)
    const bob = result.members.find((m) => m.id === 'b')
    expect(bob?.uid).toBe('uid-newperson')
    expect(bob?.name).toBe('Bob') // the placeholder's name is kept, not overwritten
  })

  it('approving the exact same request twice does not duplicate the member or change anything', () => {
    const alreadyJoined = mergeApprovedMember(offlineMembers, request()).members
    const second = mergeApprovedMember(alreadyJoined, request())
    expect(second.changed).toBe(false)
    expect(second.members).toHaveLength(alreadyJoined.length)
  })

  it('re-approving a claim that already succeeded for the same account is a harmless no-op', () => {
    const claimed = mergeApprovedMember(offlineMembers, request({ claimMemberId: 'b' })).members
    const second = mergeApprovedMember(claimed, request({ claimMemberId: 'b' }))
    expect(second.changed).toBe(false)
    expect(second.conflict).toBe(false)
  })

  // This is the real security bug that was found and fixed this session:
  // the invite preview shows every member's uid, so a join request can name
  // ANY member as the one to "claim" — including someone already linked to
  // a different real account. Approving that would silently steal their
  // identity (they'd disappear from the trip). The app must refuse instead.
  it('refuses to let a new request steal a member already linked to someone else', () => {
    const result = mergeApprovedMember(
      offlineMembers,
      request({ uid: 'uid-attacker', claimMemberId: 'a' }) // 'a' is already Alice's real account
    )
    expect(result.conflict).toBe(true)
    expect(result.changed).toBe(false)
    // Alice's real account must be untouched
    const alice = result.members.find((m) => m.id === 'a')
    expect(alice?.uid).toBe('uid-alice')
  })
})
