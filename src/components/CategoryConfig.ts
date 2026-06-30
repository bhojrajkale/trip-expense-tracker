import type { Category } from '../types'

export const CATEGORIES: { id: Category; label: string; emoji: string; color: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍽️', color: '#f59e0b' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: '#3b82f6' },
  { id: 'accommodation', label: 'Stay', emoji: '🏨', color: '#8b5cf6' },
  { id: 'activities', label: 'Activities', emoji: '🎡', color: '#10b981' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#ec4899' },
  { id: 'custom', label: 'Custom', emoji: '✏️', color: '#6b7280' },
]

export function getCategoryConfig(id: Category) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[5]
}
