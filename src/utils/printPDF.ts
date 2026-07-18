import type { Trip, Expense } from '../types'
import { formatINR, formatDate } from './format'
import { computeBalances, minimizeSettlements } from './settlement'
import { getCategoryConfig } from '../components/CategoryConfig'

// This module builds a raw HTML string written into a popup via document.write,
// bypassing React's auto-escaping — every interpolated user string (names,
// notes, custom categories, destination) MUST pass through esc() or it becomes
// a stored-XSS vector.
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Returns false (instead of failing silently) when the popup couldn't be
// opened — iOS Safari, especially in installed-PWA/standalone mode, blocks
// window.open() with no visible "popup blocked" banner at all, so without
// this the button just does nothing and the user has no way to tell why.
export function printTripSummary(trip: Trip, expenses: Expense[]): boolean {
  const memberName = (id: string) => esc(trip.members.find((m) => m.id === id)?.name ?? 'Unknown')

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPct = trip.budget > 0 ? Math.min(Math.round((totalSpent / trip.budget) * 100), 100) : 0
  const remaining = trip.budget - totalSpent

  // Category totals
  const catMap = new Map<string, { emoji: string; label: string; amount: number }>()
  for (const exp of expenses) {
    const cfg = getCategoryConfig(exp.category)
    const key = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : exp.category
    const label = exp.category === 'custom' ? (exp.customCategory ?? 'Other') : cfg.label
    const cur = catMap.get(key) ?? { emoji: cfg.emoji, label, amount: 0 }
    catMap.set(key, { ...cur, amount: cur.amount + exp.amount })
  }
  const topCats = [...catMap.values()].sort((a, b) => b.amount - a.amount)

  // Settlements
  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)

  // Expenses grouped by date descending
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))
  const grouped = sorted.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  const catRows = topCats.map((c) => `
    <tr>
      <td>${c.emoji} ${esc(c.label)}</td>
      <td style="text-align:right;font-weight:600">${formatINR(c.amount)}</td>
      <td style="text-align:right;color:#7a7a7a">${totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0}%</td>
    </tr>`).join('')

  const settlementRows = settlements.length === 0
    ? '<tr><td colspan="2" style="color:#16a34a;font-weight:600">✅ All settled up!</td></tr>'
    : settlements.map((s) => `
    <tr>
      <td><span style="color:#ef4444">${memberName(s.from)}</span> → <span style="color:#16a34a">${memberName(s.to)}</span></td>
      <td style="text-align:right;font-weight:600">${formatINR(s.amount)}</td>
    </tr>`).join('')

  const expenseRows = Object.entries(grouped).map(([date, exps]) => {
    const dayTotal = exps.reduce((s, e) => s + e.amount, 0)
    const dateHeader = `
      <tr style="background:#f5f5f7">
        <td colspan="3" style="font-weight:600;font-size:11px;color:#7a7a7a;text-transform:uppercase;letter-spacing:0.05em;padding:6px 12px">
          ${formatDate(date)}
        </td>
        <td style="text-align:right;font-weight:600;font-size:11px;color:#7a7a7a;padding:6px 12px">${formatINR(dayTotal)}</td>
      </tr>`
    const rows = exps.map((e) => {
      const cfg = getCategoryConfig(e.category)
      const label = e.category === 'custom' && e.customCategory ? esc(e.customCategory) : cfg.label
      const splitNames = e.splitBetween.map(memberName).join(', ')
      return `
      <tr>
        <td>${cfg.emoji} ${label}</td>
        <td style="color:#7a7a7a;font-size:11px">${memberName(e.paidBy)}</td>
        <td style="color:#7a7a7a;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.notes ? esc(e.notes) : splitNames}</td>
        <td style="text-align:right;font-weight:600">${formatINR(e.amount)}</td>
      </tr>`
    }).join('')
    return dateHeader + rows
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(trip.name)} — Trip Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; background: white; font-size: 13px; padding: 32px; }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
    .meta { color: #7a7a7a; font-size: 12px; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    h2 { font-size: 11px; font-weight: 700; color: #7a7a7a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0; }
    .budget-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .budget-row span { font-size: 20px; font-weight: 700; letter-spacing: -0.4px; }
    .bar-bg { background: #f0f0f0; border-radius: 4px; height: 6px; overflow: hidden; margin-bottom: 4px; }
    .bar-fill { height: 6px; border-radius: 4px; background: ${budgetPct > 100 ? '#ef4444' : budgetPct > 80 ? '#ff9500' : '#0066cc'}; width: ${budgetPct}%; }
    .bar-labels { display: flex; justify-content: space-between; font-size: 10px; color: #7a7a7a; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #b0b0b0; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${esc(trip.name)}</h1>
  <div class="meta">${esc(trip.destination)} · ${formatDate(trip.startDate)}${trip.endDate ? ' – ' + formatDate(trip.endDate) : ''} · ${trip.members.length} members · Printed ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

  <div class="section">
    <h2>Budget</h2>
    <div class="budget-row">
      <div><div style="font-size:11px;color:#7a7a7a;margin-bottom:2px">Total Spent</div><span>${formatINR(totalSpent)}</span></div>
      <div style="text-align:right"><div style="font-size:11px;color:#7a7a7a;margin-bottom:2px">${remaining < 0 ? 'Over Budget' : 'Remaining'}</div><span style="color:${remaining < 0 ? '#ef4444' : '#16a34a'}">${formatINR(Math.abs(remaining))}</span></div>
    </div>
    <div class="bar-bg"><div class="bar-fill"></div></div>
    <div class="bar-labels"><span>${budgetPct}% used</span><span>Budget: ${formatINR(trip.budget)}</span></div>
  </div>

  <div class="section">
    <h2>Spending by Category</h2>
    <table><tbody>${catRows}</tbody></table>
  </div>

  <div class="section">
    <h2>Settlements — Who Pays Whom</h2>
    <table><tbody>${settlementRows}</tbody></table>
  </div>

  <div class="section">
    <h2>All Expenses (${expenses.length})</h2>
    <table><tbody>${expenseRows}</tbody></table>
  </div>

  <div class="footer">Generated by TripTracker</div>
</body>
</html>`

  try {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return false
    win.document.write(html)
    win.document.close()
    win.focus()
    // slight delay lets the browser finish rendering before print dialog opens
    setTimeout(() => {
      win.print()
      win.close()
    }, 250)
    return true
  } catch (err) {
    console.error('printTripSummary failed', err)
    return false
  }
}
