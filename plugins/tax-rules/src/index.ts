import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'

const TaxClassSchema = z.object({
  name: z.string().min(1),
  /** Default rate as a decimal (e.g. 0.20 for 20%). Used when no country override exists. */
  defaultRate: z.number().min(0).max(1),
  /** Per-country rate overrides. Key is ISO 3166-1 alpha-2. */
  countryRates: z.record(z.string(), z.number().min(0).max(1)).default({}),
})

const ConfigSchema = z.object({
  /**
   * Named tax classes. 'standard' is the default.
   * Example: { standard: { defaultRate: 0.20, countryRates: { DE: 0.19, FR: 0.20 } } }
   */
  taxClasses: z.record(z.string(), TaxClassSchema),
  /** Countries where no tax is charged (e.g. export destinations). */
  exemptCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).default([]),
})

export type TaxRulesConfig = z.input<typeof ConfigSchema>

export type TaxCalculation = {
  countryCode: string
  taxClass: string
  rate: number
  taxAmount: number
  exempt: boolean
}

export function taxRules(input: TaxRulesConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  function calculate(
    subtotalCents: number,
    countryCode: string,
    taxClass = 'standard',
  ): TaxCalculation {
    const cc = countryCode.toUpperCase()

    if ((config.exemptCountries ?? []).includes(cc)) {
      return { countryCode: cc, taxClass, rate: 0, taxAmount: 0, exempt: true }
    }

    const cls = config.taxClasses[taxClass] ?? config.taxClasses['standard']
    if (!cls) {
      return { countryCode: cc, taxClass, rate: 0, taxAmount: 0, exempt: true }
    }

    const rate = (cls.countryRates ?? {})[cc] ?? cls.defaultRate
    const taxAmount = Math.floor(subtotalCents * rate)

    return { countryCode: cc, taxClass, rate, taxAmount, exempt: false }
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-tax-rules',
      version: '0.0.0',
    }),
    { calculate, config },
  )
}
