import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

interface Props {
  trip: Trip
  expenses: Expense[]
}

export default function Dashboard({ trip, expenses }: Props) {
  const [showShare, setShowShare] = useState(false)
  const [pdfError, setPdfError] = useState('')

  function handlePdf() {
    setPdfError('')
    const opened = printTripSummary(trip, expenses)
    if (!opened) {
      setPdfError("Couldn't open the PDF preview — your browser may be blocking pop-ups for this site.")
    }
  }

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const budgetPct = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0
  const remaining = trip.budget - totalSpent

  const balances = useMemo(() => computeBalances(expenses, trip.members), [expenses, trip.members])
  const settlements = useMemo(() => minimizeSettlements(balances), [balances])
  const memberName = (id: string) => trip.members.find((m) => m.id === id)?.name ?? 'Unknown'

  // Biggest spender first — the ranking is the point of a bar chart like this.
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

  const chartColors = useCssVars(['--action', '--ink', '--muted', '--divider', '--surface', '--hairline'])

  const card = 'bg-[var(--surface)] border border-[var(--hairline)] rounded-[18px] p-4'

  if (expenses.length === 0) {
    return (
      <div className="p-4 pb-32 space-y-4">
        <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />
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
          onClick={handlePdf}
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

      <BudgetCard totalSpent={totalSpent} budget={trip.budget} budgetPct={budgetPct} remaining={remaining} />

      {/* Per-person spend */}
      {trip.members.length > 0 && (
        <div className={card}>
          <p className="text-sm font-semibold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.1px' }}>Spent by Member</p>
          {/* Single series (amount per member) — no legend needed, the card
              title already says what's plotted; identity comes from the axis
              labels, not from per-bar color. */}
          <div style={{ width: '100%', height: Math.max(120, spendByMember.length * 44) }}>
            {chartColors['--action'] && (
              <ResponsiveContainer>
                <BarChart
                  data={spendByMember}
                  layout="vertical"
                  margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
                  barCategoryGap={12}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={chartColors['--divider']}
                    strokeWidth={1}
                  />
                  <XAxis
                    type="number"
                    // Headroom so the direct value label at the tip of the
                    // largest bar never gets clipped against the chart edge.
                    domain={[0, (max: number) => Math.ceil((max * 1.2) / 500) * 500]}
                    tickFormatter={(v) => formatINR(v)}
                    tick={{ fill: chartColors['--muted'], fontSize: 11 }}
                    axisLine={{ stroke: chartColors['--hairline'] }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tick={{ fill: chartColors['--ink'], fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: chartColors['--divider'] }}
                    formatter={(value) => [formatINR(Number(value)), 'Spent']}
                    contentStyle={{
                      background: chartColors['--surface'],
                      border: `1px solid ${chartColors['--hairline']}`,
                      borderRadius: 11,
                      fontSize: 12,
                      color: chartColors['--ink'],
                    }}
                    // Value text stays in the ink token, not the bar's accent
                    // color — the bar itself is the identity cue, text never
                    // carries the data color.
                    itemStyle={{ color: chartColors['--ink'], fontWeight: 600 }}
                    labelStyle={{ color: chartColors['--muted'] }}
                  />
                  <Bar dataKey="amount" fill={chartColors['--action']} radius={[0, 6, 6, 0]} maxBarSize={22}>
                    <LabelList
                      dataKey="amount"
                      position="right"
                      formatter={(v) => formatINR(Number(v))}
                      fill={chartColors['--muted']}
                      fontSize={11}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
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
    </div>
  )
}

function BudgetCard({
  totalSpent, budget, budgetPct, remaining,
}: {
  totalSpent: number; budget: number; budgetPct: number; remaining: number
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
    </div>
  )
}
