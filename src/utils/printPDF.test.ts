import { describe, it, expect, vi } from 'vitest'
import { esc, printTripSummary } from './printPDF'
import type { Trip } from '../types'

describe('esc (PDF export HTML safety)', () => {
  it('leaves an ordinary name unchanged', () => {
    expect(esc('Bhojraj Kale')).toBe('Bhojraj Kale')
  })

  it('neutralizes a name/note containing a script tag', () => {
    // This is the actual bug that was fixed: a member name or note like this
    // used to run as real HTML/script in the printed PDF popup.
    const result = esc('<img src=x onerror="alert(1)">')
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;img')
  })

  it('escapes quotes and ampersands too', () => {
    expect(esc(`Tom & "Jerry"`)).toBe('Tom &amp; &quot;Jerry&quot;')
  })
})

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

describe('printTripSummary — reports failure instead of doing nothing silently', () => {
  it('returns false (never throws) when there is no way to open a window at all', () => {
    // Simulates the real-world case that motivated this: iOS Safari (often
    // in installed-PWA mode) blocking window.open() with no visible warning.
    expect(printTripSummary(trip(), [])).toBe(false)
  })

  it('returns false when window.open is blocked (returns null)', () => {
    vi.stubGlobal('window', { open: () => null })
    expect(printTripSummary(trip(), [])).toBe(false)
    vi.unstubAllGlobals()
  })

  it('returns true once a window is actually opened, and prints it shortly after', () => {
    vi.useFakeTimers()
    const fakeWin = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    }
    vi.stubGlobal('window', { open: () => fakeWin })

    expect(printTripSummary(trip(), [])).toBe(true)
    expect(fakeWin.document.write).toHaveBeenCalled()
    expect(fakeWin.print).not.toHaveBeenCalled() // not yet — it's on a short delay

    vi.runAllTimers()
    expect(fakeWin.print).toHaveBeenCalled()
    expect(fakeWin.close).toHaveBeenCalled()

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
