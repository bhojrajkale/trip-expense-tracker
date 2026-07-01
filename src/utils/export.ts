import type { Trip, Expense } from '../types'
import { getCategoryConfig } from '../components/CategoryConfig'
import { computeBalances, minimizeSettlements } from './settlement'

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function downloadCSV(trip: Trip, expenses: Expense[]): void {
  const memberMap = new Map(trip.members.map((m) => [m.id, m.name]))

  const header = ['Date', 'Category', 'Amount (₹)', 'Paid By', 'Split Between', 'Notes']

  const expenseRows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((exp) => {
      const category =
        exp.category === 'custom' && exp.customCategory
          ? exp.customCategory
          : getCategoryConfig(exp.category).label

      const paidBy = memberMap.get(exp.paidBy) ?? exp.paidBy

      const splitBetween = exp.splitBetween
        .map((id) => memberMap.get(id) ?? id)
        .join(' & ')

      return [
        escapeCell(exp.date),
        escapeCell(category),
        escapeCell(String(exp.amount)),
        escapeCell(paidBy),
        escapeCell(splitBetween),
        escapeCell(exp.notes),
      ].join(',')
    })

  // Settlement section
  const balances = computeBalances(expenses, trip.members)
  const settlements = minimizeSettlements(balances)

  const settlementRows = [
    '',
    escapeCell('Settlement Summary'),
    escapeCell('Who Pays') + ',' + escapeCell('Who Receives') + ',' + escapeCell('Amount (₹)'),
    ...settlements.map((s) =>
      [
        escapeCell(memberMap.get(s.from) ?? s.from),
        escapeCell(memberMap.get(s.to) ?? s.to),
        escapeCell(String(s.amount)),
      ].join(',')
    ),
  ]

  const csv = [
    header.map(escapeCell).join(','),
    ...expenseRows,
    ...(settlements.length > 0 ? settlementRows : []),
  ].join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name} - Expenses.csv`
  a.click()
  URL.revokeObjectURL(url)
}
