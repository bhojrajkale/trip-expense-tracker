import { describe, it, expect } from 'vitest'
import { escapeCell } from './export'

describe('escapeCell (CSV export safety)', () => {
  it('leaves an ordinary name untouched (aside from quoting)', () => {
    expect(escapeCell('Bhojraj Kale')).toBe('"Bhojraj Kale"')
  })

  it('neutralizes a value that looks like a spreadsheet formula', () => {
    // This is the actual bug that was fixed: a name/note starting with "="
    // could otherwise execute as a hidden formula when opened in Excel/Sheets.
    const result = escapeCell('=HYPERLINK("http://evil.example","Click me")')
    expect(result.startsWith('"\'')).toBe(true)
  })

  it('neutralizes values starting with +, -, @, tab, or a carriage return', () => {
    for (const dangerous of ['+1+1', '-2+3', '@SUM(1,1)', '\tsneaky', '\rsneaky']) {
      const result = escapeCell(dangerous)
      expect(result).toContain(`"'${dangerous}`)
    }
  })

  it('escapes double quotes inside the value so the CSV stays valid', () => {
    expect(escapeCell('Say "hi"')).toBe('"Say ""hi"""')
  })
})
