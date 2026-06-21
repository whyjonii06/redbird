import { describe, expect, it } from 'vitest'
import { taxRules } from './index.js'

const plugin = taxRules({
  taxClasses: {
    standard: {
      name: 'Standard rate',
      defaultRate: 0.2,
      countryRates: { DE: 0.19, FR: 0.2, US: 0.0 },
    },
    reduced: {
      name: 'Reduced rate',
      defaultRate: 0.1,
      countryRates: { FR: 0.055 },
    },
  },
  exemptCountries: ['AE', 'HK'],
})

describe('tax-rules', () => {
  it('applies default rate', () => {
    const t = plugin.calculate(10000, 'GB')
    expect(t.rate).toBe(0.2)
    expect(t.taxAmount).toBe(2000)
    expect(t.exempt).toBe(false)
  })

  it('applies country override', () => {
    const t = plugin.calculate(10000, 'DE')
    expect(t.rate).toBe(0.19)
    expect(t.taxAmount).toBe(1900)
  })

  it('uses reduced tax class', () => {
    const t = plugin.calculate(10000, 'FR', 'reduced')
    expect(t.rate).toBe(0.055)
    expect(t.taxAmount).toBe(550)
  })

  it('returns 0 for exempt country', () => {
    const t = plugin.calculate(10000, 'AE')
    expect(t.exempt).toBe(true)
    expect(t.taxAmount).toBe(0)
  })

  it('falls back to standard when class not found', () => {
    const t = plugin.calculate(10000, 'FR', 'luxury')
    expect(t.rate).toBe(0.2)
  })
})
