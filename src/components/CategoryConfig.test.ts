import { describe, it, expect } from 'vitest'
import { getCategoryConfig, CATEGORIES } from './CategoryConfig'

describe('getCategoryConfig', () => {
  it('finds the right config for a known category', () => {
    const food = getCategoryConfig('food')
    expect(food.label).toBe('Food')
  })

  it('every real category id can be looked up', () => {
    for (const cat of CATEGORIES) {
      expect(getCategoryConfig(cat.id).id).toBe(cat.id)
    }
  })

  it('falls back to the "custom" entry instead of crashing on an unrecognized id', () => {
    // Simulates old/corrupt data that doesn't match any known category.
    // @ts-expect-error deliberately passing an invalid category
    const fallback = getCategoryConfig('something-made-up')
    expect(fallback.id).toBe('custom')
  })
})
