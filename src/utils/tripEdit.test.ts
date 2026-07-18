import { describe, it, expect } from 'vitest'
import { mergeTripEdit } from './tripEdit'
import type { Trip } from '../types'

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

describe('mergeTripEdit', () => {
  it('applies the edited fields', () => {
    const existing = trip({ budget: 1000 })
    const result = mergeTripEdit(existing, { ...existing, budget: 5000 })
    expect(result.budget).toBe(5000)
  })

  // This is the exact regression that happened once for real: editing a
  // trip through the form silently deleted archived/paidSettlements/endDate
  // because the save path rebuilt the trip from the form's fields alone.
  it('never erases fields the edit form does not know about', () => {
    const existing = trip({
      archived: true,
      endDate: '2026-01-10',
      paidSettlements: [{ from: 'a', to: 'b', paidAt: '2026-01-05' }],
    })
    // Simulate the form only submitting the fields it owns
    const formOutput = {
      id: existing.id,
      name: 'Renamed Trip',
      destination: existing.destination,
      startDate: existing.startDate,
      budget: 2000,
      members: existing.members,
    }
    const result = mergeTripEdit(existing, formOutput)
    expect(result.name).toBe('Renamed Trip')
    expect(result.budget).toBe(2000)
    expect(result.archived).toBe(true)
    expect(result.endDate).toBe('2026-01-10')
    expect(result.paidSettlements).toEqual([{ from: 'a', to: 'b', paidAt: '2026-01-05' }])
  })
})
