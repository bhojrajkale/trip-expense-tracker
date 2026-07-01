import type { Trip, Expense } from '../types'
import { getCategoryConfig } from '../components/CategoryConfig'

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function downloadCSV(trip: Trip, expenses: Expense[]): void {
  const memberMap = new Map(trip.members.map((m) => [m.id, m.name]))

  const header = ['Date', 'Category', 'Amount (₹)', 'Paid By', 'Split Between', 'Notes']

  const rows = [...expenses]
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

  const csv = [header.map(escapeCell).join(','), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name} - Expenses.csv`
  a.click()
  URL.revokeObjectURL(url)
}
