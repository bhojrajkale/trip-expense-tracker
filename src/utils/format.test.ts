import { describe, it, expect } from 'vitest'
import { formatINR, formatDate, initials } from './format'

describe('formatINR', () => {
  it('shows the rupee symbol', () => {
    expect(formatINR(1250)).toContain('₹')
  })

  it('rounds off to whole rupees (no paise shown)', () => {
    expect(formatINR(1250.75)).not.toContain('.')
  })

  it('formats zero without crashing', () => {
    expect(formatINR(0)).toContain('₹')
  })
})

describe('formatDate', () => {
  it('produces a short, human-readable date', () => {
    const result = formatDate('2026-01-15')
    // Don't over-assert on exact locale spacing — just that it read the
    // right day and month, not a garbled/invalid date.
    expect(result).toMatch(/15/)
    expect(result.toLowerCase()).toMatch(/jan/)
  })
})

describe('initials', () => {
  it('takes the first letter of each of the first two words', () => {
    expect(initials('Bhojraj Kale')).toBe('BK')
  })

  it('uppercases the result', () => {
    expect(initials('rohan mehta')).toBe('RM')
  })

  it('handles a single-word name', () => {
    expect(initials('Cher')).toBe('C')
  })

  it('never returns more than two characters, even for long names', () => {
    expect(initials('Priya Ann Sharma Iyer').length).toBeLessThanOrEqual(2)
  })
})
