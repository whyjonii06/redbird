import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'

const ZoneSchema = z.object({
  name: z.string().min(1),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 code')),
  rateAmount: z.number().int().min(0),
  rateCurrency: z.string().regex(/^[A-Z]{3}$/),
  freeOver: z.number().int().min(0).optional(),
})

const ConfigSchema = z.object({
  zones: z.array(ZoneSchema).min(1),
  fallback: z
    .object({
      rateAmount: z.number().int().min(0),
      rateCurrency: z.string().regex(/^[A-Z]{3}$/),
    })
    .optional(),
})

export type ShippingFlatConfig = z.input<typeof ConfigSchema>

export type ShippingRate = {
  readonly zone: string | null
  readonly amount: number
  readonly currency: string
  readonly free: boolean
  readonly reason?: 'free-shipping-threshold' | 'no-zone-match'
}

export function shippingFlat(input: ShippingFlatConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  function calculate(country: string, subtotalAmount: number, currency: string): ShippingRate {
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
        reason: 'free-shipping-threshold',
      }
    }

    return {
      zone: zone.name,
      amount: zone.rateAmount,
      currency: zone.rateCurrency,
      free: false,
    }
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-shipping-flat',
      version: '0.0.0',
    }),
    { calculate, config },
  )
}
