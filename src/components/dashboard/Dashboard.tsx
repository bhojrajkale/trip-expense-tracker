import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Expense, Trip } from '../../types'
import { formatINR } from '../../utils/format'
import { computeBalances, minimizeSettlements } from '../../utils/settlement'
import ShareModal from '../ShareModal'
import { printTripSummary } from '../../utils/printPDF'

// Resolves CSS custom properties to their current computed value so recharts
// (which needs real color strings, not var(...), for reliable cross-browser
// SVG rendering — notably iOS Safari) stays in sync with the light/dark
// toggle. Re-reads whenever <html data-theme> changes.
function useCssVars(names: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement)
      setValues(Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()])))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
    // `names` is a fixed literal array at each call site; re-running per
    // render would defeat the MutationObserver's whole purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return values
}

// 8 fixed categorical hues, assigned in order, never cycled (CVD-safety
// mechanism — see dataviz skill). Past this ceiling the smallest spenders
// fold into a single gray "Other" slice rather than generating a 9th hue.
const CHART_SLOTS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8']

interface Props {
  trip: Trip
  expenses: Expense[]
}

export default function Dashboard({ trip, expenses }: Props) {
  const [showShare, setShowShare] = useState(false)
  const [showPdfOptions, setShowPdfOptions] = useState(false)
  const [includeCategoryBreakdown, setIncludeCategoryBreakdown] = useState(true)
  const [pdfError, setPdfError] = useState('')

  function handleGeneratePdf() {
    setPdfError('')
    setShowPdfOptions(false)
    const opened = printTripSummary(trip, expenses, { includeCategoryBreakdown })
    if (!opened) {
      setPdfError("Couldn't open the PDF preview — your browser may be blocking pop-ups for this site.")
    }
  }

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const budgetPct = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0
  const remaining = trip.budget - totalSpent
  // Equal-share benchmark: what everyone would have paid so far if the
  // trip's spend to date were split evenly — not a settlement, just the
  // reference line the per-member breakdown compares each person against.
  const perHeadExpected = trip.members.length > 0 ? totalSpent / trip.members.length : 0

  const balances = useMemo(() => computeBalances(expenses, trip.members), [expenses, trip.members])
  const settlements = useMemo(() => minimizeSettlements(balances), [balances])
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  // Biggest spender first — the ranking is the point of a chart like this.
  const spendByMember = useMemo(
    () =>
      trip.members
        .map((m) => ({
          name: m.name,
          amount: expenses.filter((e) => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0),
        }))
        .sort((a, b) => b.amount - a.amount),
    [expenses, trip.members]
  )

  // Zero-spend members don't get a slice.
  const pieData = useMemo(() => {
    const withSpend = spendByMember.filter((m) => m.amount > 0)
    if (withSpend.length <= CHART_SLOTS.length) return withSpend
    const head = withSpend.slice(0, CHART_SLOTS.length - 1)
    const tail = withSpend.slice(CHART_SLOTS.length - 1)
    return [...head, { name: 'Other', amount: tail.reduce((s, m) => s + m.amount, 0) }]
  }, [spendByMember])

  const chartColors = useCssVars(['--ink', '--muted', '--divider', '--surface', '--hairline', ...CHART_SLOTS])
  const sliceColor = (i: number, name: string) =>
    name === 'Other' ? chartColors['--muted'] : chartColors[CHART_SLOTS[i]]

  const card = 'bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4'

  if (expenses.length === 0) {
    return (
      <div className="p-4 pb-32 space-y-4">
        <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} perHeadExpected={perHeadExpected} />
        <div className="flex flex-col items-center py-16 text-[var(--muted)]">
          <span className="text-5xl mb-3">📊</span>
          <p className="text-sm">No expenses yet.</p>
          <p className="text-xs mt-1">Add expenses to see your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowPdfOptions(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] bg-[var(--surface)] border border-[var(--hairline)] px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          📄 PDF
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--action)] bg-[var(--action-tint)] border border-[var(--action-border)] px-3 py-2 rounded-full active:scale-95 transition-transform"
        >
          📤 Share
        </button>
      </div>

      {pdfError && (
        <p className="text-[var(--orange)] text-sm bg-[var(--orange-tint)] rounded-[11px] p-3">{pdfError}</p>
      )}

      <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} perHeadExpected={perHeadExpected} />

      {/* Per-person spend */}
      {pieData.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.1px' }}>Spent by Member</p>
          <div className="relative" style={{ width: '100%', height: 220 }}>
            {chartColors['--chart-1'] && (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="90%"
                    paddingAngle={pieData.length > 1 ? 2 : 0}
                    stroke={chartColors['--surface']}
                    strokeWidth={2}
                  >
                    {pieData.map((slice, i) => (
                      <Cell key={slice.name} fill={sliceColor(i, slice.name)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${formatINR(Number(value))} · ${((Number(value) / totalSpent) * 100).toFixed(0)}%`,
                      name,
                    ]}
                    contentStyle={{
                      background: chartColors['--surface'],
                      border: `1px solid ${chartColors['--hairline']}`,
                      borderRadius: 11,
                      fontSize: 12,
                      color: chartColors['--ink'],
                    }}
                    itemStyle={{ color: chartColors['--ink'], fontWeight: 600 }}
                    labelStyle={{ color: chartColors['--muted'] }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Center readout — the hole in the donut is otherwise dead space */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-[var(--muted)]">Total</span>
              <span className="text-lg font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.3px' }}>
                {formatINR(totalSpent)}
              </span>
            </div>
          </div>
          {/* Direct labels for every slice — identity + value + share stay
              readable without hovering, and never depend on color alone. */}
          <div className="space-y-2.5 mt-1">
            {pieData.map((slice, i) => {
              // "Other" is a folded-together bucket of several members, so a
              // single-person delta against the average would be misleading.
              const delta = slice.name === 'Other' ? null : slice.amount - perHeadExpected
              return (
                <div key={slice.name}>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0"
                      style={{ backgroundColor: sliceColor(i, slice.name) }}
                    />
                    <span className="text-[var(--ink)] truncate">{slice.name}</span>
                    <span className="text-[var(--muted)] text-xs flex-shrink-0">
                      {totalSpent > 0 ? ((slice.amount / totalSpent) * 100).toFixed(0) : 0}%
                    </span>
                    <span className="text-[var(--ink)] font-semibold ml-auto flex-shrink-0">
                      {formatINR(slice.amount)}
                    </span>
                  </div>
                  {delta !== null && Math.abs(delta) >= 1 && (
                    <p className={`text-[10px] mt-0.5 pl-[18px] ${delta > 0 ? 'text-[var(--orange)]' : 'text-[var(--green)]'}`}>
                      {delta > 0 ? '+' : '−'}{formatINR(Math.abs(delta))} vs expected per head
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.1px' }}>Quick Settlement</p>
          <div className="space-y-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--red)] font-medium truncate">{memberName(s.from)}</span>
                <span className="text-[var(--muted)] text-xs">→</span>
                <span className="text-[var(--green)] font-medium truncate">{memberName(s.to)}</span>
                <span className="text-[var(--ink)] font-semibold ml-auto">{formatINR(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShare && (
        <ShareModal trip={trip} expenses={expenses} onClose={() => setShowShare(false)} />
      )}

      {showPdfOptions && (
        <div
          className="fixed inset-0 z-[200] flex items-end bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setShowPdfOptions(false)}
        >
          <div className="w-full bg-[var(--bg)] rounded-t-[18px] border-t border-[var(--hairline)]">
            <div className="w-10 h-1 bg-[var(--disabled)] rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.2px' }}>
                  Export PDF
                </h2>
                <button onClick={() => setShowPdfOptions(false)} className="text-[var(--muted)] text-sm">Close</button>
              </div>

              <button
                type="button"
                onClick={() => setIncludeCategoryBreakdown((v) => !v)}
                className="w-full flex items-center gap-3 p-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] mb-5 text-left"
              >
                <span
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    includeCategoryBreakdown ? 'bg-[var(--action)] border-[var(--action)]' : 'border-[var(--disabled)]'
                  }`}
                >
                  {includeCategoryBreakdown && <span className="text-white text-xs">✓</span>}
                </span>
                <span className="flex-1">
                  <span className="block text-sm text-[var(--ink)]">Include spending by category</span>
                  <span className="block text-xs text-[var(--muted)] mt-0.5">Adds a category breakdown table to the PDF</span>
                </span>
              </button>

              <button
                onClick={handleGeneratePdf}
                className="w-full py-4 rounded-full bg-[var(--action)] text-white font-medium text-base active:scale-95 transition-transform"
                style={{ marginBottom: 'max(24px, env(safe-area-inset-bottom))' }}
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetCard({
  totalSpent, budget, budgetPct, remaining, perHeadExpected,
}: {
  totalSpent: number; budget: number; budgetPct: number; remaining: number; perHeadExpected: number
}) {
  const isOver = remaining < 0
  const isWarning = !isOver && budgetPct > 80
  const barColor = isOver ? 'bg-[var(--red)]' : isWarning ? 'bg-[var(--orange)]' : 'bg-[var(--action)]'
  const remainColor = isOver ? 'text-[var(--red)]' : isWarning ? 'text-[var(--orange)]' : 'text-[var(--green)]'

  return (
    <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-[var(--muted)] mb-0.5">Total Spent</p>
          <p className="text-2xl font-semibold text-[var(--ink)]" style={{ letterSpacing: '-0.5px' }}>{formatINR(totalSpent)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)] mb-0.5">{isOver ? 'Over Budget' : 'Remaining'}</p>
          <p className={`text-2xl font-semibold ${remainColor}`} style={{ letterSpacing: '-0.5px' }}>
            {formatINR(Math.abs(remaining))}
          </p>
        </div>
      </div>
      <div className="bg-[var(--divider)] rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${budgetPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[var(--muted)]">{budgetPct.toFixed(0)}% used</span>
        <span className="text-[10px] text-[var(--muted)]">Budget: {formatINR(budget)}</span>
      </div>
      {totalSpent > 0 && (
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--divider)]">
          <span className="text-xs text-[var(--muted)]">Expected per head (so far)</span>
          <span className="text-sm font-semibold text-[var(--ink)]">{formatINR(perHeadExpected)}</span>
        </div>
      )}
    </div>
  )
}
