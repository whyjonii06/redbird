import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'

const WeightTierSchema = z.object({
  /** Maximum weight in grams (inclusive). Use Infinity or omit for the last tier. */
  maxWeightGrams: z.number().int().positive().optional(),
  /** Shipping cost in smallest currency unit (cents). */
  rateAmount: z.number().int().min(0),
})

const ZoneSchema = z.object({
  name: z.string().min(1),
  /** ISO 3166-1 alpha-2 country codes covered by this zone. */
  countries: z.array(z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 code')),
  /** Weight tiers in ascending order by maxWeightGrams. Last tier has no max. */
  weightTiers: z.array(WeightTierSchema).min(1),
  rateCurrency: z.string().regex(/^[A-Z]{3}$/),
  /** Free shipping when subtotal exceeds this amount (cents). */
  freeOver: z.number().int().min(0).optional(),
})

const ConfigSchema = z.object({
  zones: z.array(ZoneSchema).min(1),
  /** Fallback rate when no zone matches. If omitted, unmatched countries get free shipping. */
  fallback: z
    .object({
      rateAmount: z.number().int().min(0),
      rateCurrency: z.string().regex(/^[A-Z]{3}$/),
    })
    .optional(),
})

export type ShippingZonesConfig = z.input<typeof ConfigSchema>

export type ShippingZoneRate = {
  readonly zone: string | null
  readonly amount: number
  readonly currency: string
  readonly free: boolean
  readonly reason?: 'free-over-threshold' | 'no-zone-match' | 'weight-over-max'
}

export function shippingZones(input: ShippingZonesConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  function calculate(
    country: string,
    subtotalAmount: number,
    weightGrams: number,
    currency: string,
  ): ShippingZoneRate {
    const zone = config.zones.find((z) => z.countries.includes(country.toUpperCase()))

    if (!zone) {
      if (config.fallback) {
        return {
          zone: null,
          amount: config.fallback.rateAmount,
          currency: config.fallback.rateCurrency,
          free: false,
          reason: 'no-zone-match',
        }
      }
      return { zone: null, amount: 0, currency, free: true, reason: 'no-zone-match' }
    }

    if (zone.freeOver !== undefined && subtotalAmount >= zone.freeOver) {
      return {
        zone: zone.name,
        amount: 0,
        currency: zone.rateCurrency,
        free: true,
        reason: 'free-over-threshold',
      }
    }

    // Find the applicable weight tier
    const sortedTiers = [...zone.weightTiers].sort(
      (a, b) => (a.maxWeightGrams ?? Infinity) - (b.maxWeightGrams ?? Infinity),
    )
    const tier =
      sortedTiers.find((t) => t.maxWeightGrams === undefined || weightGrams <= t.maxWeightGrams) ??
      sortedTiers[sortedTiers.length - 1]

    if (!tier) {
      return { zone: zone.name, amount: 0, currency: zone.rateCurrency, free: true }
    }

    return {
      zone: zone.name,
      amount: tier.rateAmount,
      currency: zone.rateCurrency,
      free: false,
    }
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-shipping-zones',
      version: '0.0.0',
    }),
    { calculate, config },
  )
}
