import { describe, expect, it } from 'vitest'
import { addMoney, formatMoney, money, multiplyMoney, zeroMoney } from './index.js'

describe('money', () => {
  it('creates a money value', () => {
    const m = money(1999, 'EUR')
    expect(m.amount).toBe(1999)
    expect(m.currency).toBe('EUR')
  })

  it('rejects non-integer amounts', () => {
    expect(() => money(19.99, 'EUR')).toThrow(/integer/)
  })

  it('rejects invalid currency codes', () => {
    expect(() => money(100, 'euro')).toThrow(/ISO 4217/)
    expect(() => money(100, 'EU')).toThrow(/ISO 4217/)
  })

  it('adds two money values of the same currency', () => {
    const sum = addMoney(money(1000, 'EUR'), money(500, 'EUR'))
    expect(sum.amount).toBe(1500)
    expect(sum.currency).toBe('EUR')
  })

  it('rejects adding mismatched currencies', () => {
    expect(() => addMoney(money(100, 'EUR'), money(100, 'USD'))).toThrow(/Currency mismatch/)
  })

  it('multiplies and rounds correctly', () => {
    expect(multiplyMoney(money(333, 'EUR'), 3).amount).toBe(999)
    expect(multiplyMoney(money(100, 'EUR'), 0.5).amount).toBe(50)
    expect(multiplyMoney(money(100, 'EUR'), 0.333).amount).toBe(33)
  })

  it('creates zero money', () => {
    expect(zeroMoney('EUR')).toEqual({ amount: 0, currency: 'EUR' })
  })

  it('formats money with locale', () => {
    expect(formatMoney(money(1999, 'EUR'), 'fr-FR')).toMatch(/19,99/)
    expect(formatMoney(money(1999, 'USD'), 'en-US')).toBe('$19.99')
  })
})
