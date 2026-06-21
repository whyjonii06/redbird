import { describe, expect, it } from 'vitest'
import { vatEu } from './index.js'
import { EU_VAT_RATES, getRates, isEuCountry } from './rates.js'
import { parseVatNumber } from './vies.js'

const vat = vatEu({ homeCountry: 'FR', dryRun: true })

describe('Rate table', () => {
  it('covers all 27 EU member states', () => {
    const EU27 = [
      'AT',
      'BE',
      'BG',
      'CY',
      'CZ',
      'DE',
      'DK',
      'EE',
      'ES',
      'FI',
      'FR',
      'GR',
      'HR',
      'HU',
      'IE',
      'IT',
      'LT',
      'LU',
      'LV',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SE',
      'SI',
      'SK',
    ]
    for (const code of EU27) {
      expect(EU_VAT_RATES[code], `Missing rates for ${code}`).toBeDefined()
    }
    expect(Object.keys(EU_VAT_RATES)).toHaveLength(27)
  })

  it('all standard rates are between 15% and 30%', () => {
    for (const [code, entry] of Object.entries(EU_VAT_RATES)) {
      expect(entry.standard, `${code} standard rate out of range`).toBeGreaterThanOrEqual(0.15)
      expect(entry.standard, `${code} standard rate out of range`).toBeLessThanOrEqual(0.3)
    }
  })

  it('isEuCountry returns true for EU codes, false for others', () => {
    expect(isEuCountry('FR')).toBe(true)
    expect(isEuCountry('de')).toBe(true) // case-insensitive
    expect(isEuCountry('US')).toBe(false)
    expect(isEuCountry('GB')).toBe(false) // Brexit
    expect(isEuCountry('CH')).toBe(false)
  })

  it('getRates returns correct entry for FR', () => {
    const fr = getRates('FR')
    expect(fr?.standard).toBe(0.2)
    expect(fr?.reduced).toBe(0.1)
    expect(fr?.superReduced).toBe(0.055)
  })
})

describe('vatEu.calculate — standard B2C', () => {
  it('applies French standard rate (20%) to 100€', () => {
    const result = vat.calculate(10000, 'FR')
    expect(result.rate).toBe(0.2)
    expect(result.taxAmount).toBe(2000)
    expect(result.reverseCharge).toBe(false)
    expect(result.rateType).toBe('standard')
  })

  it('applies German standard rate (19%) to 50€', () => {
    const result = vat.calculate(5000, 'DE')
    expect(result.rate).toBe(0.19)
    expect(result.taxAmount).toBe(950)
  })

  it('applies Danish standard rate (25%) — no reduced rate in DK', () => {
    const result = vat.calculate(10000, 'DK', { rateType: 'reduced' })
    expect(result.rate).toBe(0.25) // DK has no reduced rate, falls back to standard
  })

  it('applies reduced rate when requested', () => {
    const result = vat.calculate(10000, 'FR', { rateType: 'reduced' })
    expect(result.rate).toBe(0.1)
    expect(result.taxAmount).toBe(1000)
  })

  it('applies super-reduced rate when available', () => {
    const result = vat.calculate(10000, 'FR', { rateType: 'super_reduced' })
    expect(result.rate).toBe(0.055)
    expect(result.taxAmount).toBe(550)
  })

  it('falls back to reduced rate when super_reduced is unavailable', () => {
    const result = vat.calculate(10000, 'DE', { rateType: 'super_reduced' })
    expect(result.rate).toBe(0.07) // DE has no super-reduced → falls back to reduced
  })

  it('truncates fractional cents (floor)', () => {
    // 10001 * 0.20 = 2000.2 → floor → 2000
    const result = vat.calculate(10001, 'FR')
    expect(result.taxAmount).toBe(2000)
  })
})

describe('vatEu.calculate — non-EU export', () => {
  it('returns 0% VAT for US customers', () => {
    const result = vat.calculate(10000, 'US')
    expect(result.rate).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.rateType).toBe('exempt')
  })

  it('returns 0% VAT for GB (post-Brexit)', () => {
    const result = vat.calculate(10000, 'GB')
    expect(result.rateType).toBe('exempt')
  })
})

describe('vatEu.calculate — B2B reverse charge', () => {
  it('applies reverse charge when valid EU VAT number provided', () => {
    const result = vat.calculate(10000, 'DE', { vatNumber: 'DE123456789' })
    expect(result.reverseCharge).toBe(true)
    expect(result.rate).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.rateType).toBe('reverse_charge')
  })

  it('ignores malformed VAT number (falls back to regular rate)', () => {
    const result = vat.calculate(10000, 'DE', { vatNumber: 'INVALID' })
    expect(result.reverseCharge).toBe(false)
    expect(result.rate).toBe(0.19)
  })

  it('reverse charge applies regardless of customer country', () => {
    const result = vat.calculate(10000, 'FR', { vatNumber: 'BE0999999999' })
    expect(result.reverseCharge).toBe(true)
  })
})

describe('parseVatNumber', () => {
  it('parses valid VAT numbers', () => {
    expect(parseVatNumber('FR12345678901')).toEqual({ countryCode: 'FR', number: '12345678901' })
    expect(parseVatNumber('DE 123 456 789')).toEqual({ countryCode: 'DE', number: '123456789' })
    expect(parseVatNumber('be0999999999')).toEqual({ countryCode: 'BE', number: '0999999999' })
  })

  it('returns null for invalid format', () => {
    expect(parseVatNumber('INVALID')).toBeNull()
    expect(parseVatNumber('F123')).toBeNull()
    expect(parseVatNumber('')).toBeNull()
  })
})

describe('vatEu.validateVatNumber (dryRun)', () => {
  it('returns valid: true in dryRun mode', async () => {
    const result = await vat.validateVatNumber('FR12345678901')
    expect(result.valid).toBe(true)
    expect(result.countryCode).toBe('FR')
  })

  it('returns valid: false for malformed number', async () => {
    const result = await vat.validateVatNumber('NOTAVALUE')
    expect(result.valid).toBe(false)
  })
})
