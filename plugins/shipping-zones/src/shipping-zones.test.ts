import { describe, expect, it } from 'vitest'
import { shippingZones } from './index.js'

const plugin = shippingZones({
  zones: [
    {
      name: 'Europe',
      countries: ['FR', 'DE', 'ES'],
      rateCurrency: 'EUR',
      freeOver: 5000,
      weightTiers: [
        { maxWeightGrams: 500, rateAmount: 399 },
        { maxWeightGrams: 2000, rateAmount: 699 },
        { rateAmount: 999 },
      ],
    },
    {
      name: 'UK',
      countries: ['GB'],
      rateCurrency: 'GBP',
      weightTiers: [{ rateAmount: 599 }],
    },
  ],
  fallback: { rateAmount: 1299, rateCurrency: 'EUR' },
})

describe('shipping-zones', () => {
  it('returns correct tier for light package in zone', () => {
    const rate = plugin.calculate('FR', 2000, 300, 'EUR')
    expect(rate.zone).toBe('Europe')
    expect(rate.amount).toBe(399)
    expect(rate.free).toBe(false)
  })

  it('returns correct tier for heavy package in zone', () => {
    const rate = plugin.calculate('DE', 2000, 2500, 'EUR')
    expect(rate.zone).toBe('Europe')
    expect(rate.amount).toBe(999)
  })

  it('applies free shipping threshold', () => {
    const rate = plugin.calculate('FR', 5000, 300, 'EUR')
    expect(rate.free).toBe(true)
    expect(rate.amount).toBe(0)
    expect(rate.reason).toBe('free-over-threshold')
  })

  it('falls back when no zone matches', () => {
    const rate = plugin.calculate('US', 1000, 500, 'USD')
    expect(rate.zone).toBeNull()
    expect(rate.amount).toBe(1299)
    expect(rate.reason).toBe('no-zone-match')
  })

  it('handles different zone currencies', () => {
    const rate = plugin.calculate('GB', 1000, 100, 'GBP')
    expect(rate.currency).toBe('GBP')
    expect(rate.amount).toBe(599)
  })
})
