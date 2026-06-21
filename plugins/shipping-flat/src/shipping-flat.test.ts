import { describe, expect, it } from 'vitest'
import { shippingFlat } from './index.js'

describe('shipping-flat plugin', () => {
  const plugin = shippingFlat({
    zones: [
      {
        name: 'France',
        countries: ['FR'],
        rateAmount: 590,
        rateCurrency: 'EUR',
        freeOver: 5000,
      },
      {
        name: 'EU',
        countries: ['DE', 'IT', 'ES', 'BE', 'NL'],
        rateAmount: 990,
        rateCurrency: 'EUR',
      },
    ],
    fallback: { rateAmount: 1990, rateCurrency: 'EUR' },
  })

  it('matches a zone by country', () => {
    const rate = plugin.calculate('FR', 1000, 'EUR')
    expect(rate.zone).toBe('France')
    expect(rate.amount).toBe(590)
  })

  it('uppercases country codes', () => {
    expect(plugin.calculate('fr', 1000, 'EUR').zone).toBe('France')
  })

  it('applies free shipping over threshold', () => {
    const rate = plugin.calculate('FR', 5000, 'EUR')
    expect(rate.amount).toBe(0)
    expect(rate.free).toBe(true)
    expect(rate.reason).toBe('free-shipping-threshold')
  })

  it('matches another zone by membership', () => {
    expect(plugin.calculate('DE', 100, 'EUR').zone).toBe('EU')
    expect(plugin.calculate('NL', 100, 'EUR').zone).toBe('EU')
  })

  it('falls back when no zone matches', () => {
    const rate = plugin.calculate('US', 100, 'EUR')
    expect(rate.zone).toBeNull()
    expect(rate.amount).toBe(1990)
    expect(rate.reason).toBe('no-zone-match')
  })

  it('exposes the plugin name', () => {
    expect(plugin.name).toBe('@redbird/plugin-shipping-flat')
  })

  it('rejects invalid country codes in config', () => {
    expect(() =>
      shippingFlat({
        zones: [{ name: 'bad', countries: ['Fr'], rateAmount: 100, rateCurrency: 'EUR' }],
      }),
    ).toThrow(/alpha-2/)
  })
})
