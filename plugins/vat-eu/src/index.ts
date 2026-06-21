import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'
import { getRates, isEuCountry } from './rates.js'
import { type ViesResult, parseVatNumber, validateVatNumberVies } from './vies.js'

export type { ViesResult }
export { EU_VAT_RATES, EU_COUNTRY_CODES, isEuCountry, getRates } from './rates.js'

const ConfigSchema = z.object({
  /** ISO 3166-1 alpha-2 code of the seller's country. Used as fallback if customer country unknown. */
  homeCountry: z.string().length(2).toUpperCase(),
  /** When true, VIES validation returns { valid: true } without calling the EU API. */
  dryRun: z.boolean().default(false),
})

export type VatEuConfig = z.input<typeof ConfigSchema>

export type VatRateType = 'standard' | 'reduced' | 'super_reduced' | 'exempt' | 'reverse_charge'

export type VatCalculation = {
  countryCode: string
  rateType: VatRateType
  /** VAT rate as a decimal, e.g. 0.20 for 20%. 0 for reverse charge or exempt. */
  rate: number
  /** VAT amount in the smallest currency unit (cents), rounded down. */
  taxAmount: number
  /** True when the customer is a business with a valid VAT number (B2B intra-EU). */
  reverseCharge: boolean
}

export type VatService = {
  /**
   * Calculate VAT for a given subtotal amount (in cents).
   *
   * @param subtotalCents - Pre-tax amount in smallest currency unit.
   * @param countryCode   - Customer's country (ISO 3166-1 alpha-2).
   * @param opts.rateType - Which rate to apply. Defaults to 'standard'.
   * @param opts.vatNumber - If provided and valid format, applies reverse charge (0% VAT).
   */
  calculate(
    subtotalCents: number,
    countryCode: string,
    opts?: { rateType?: 'standard' | 'reduced' | 'super_reduced'; vatNumber?: string | undefined },
  ): VatCalculation

  /**
   * Validate a VAT number via the EU VIES service.
   * In dryRun mode, skips the network call and returns { valid: true }.
   */
  validateVatNumber(vatNumber: string): Promise<ViesResult>
}

export function vatEu(input: VatEuConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  const service: VatService = {
    calculate(subtotalCents, countryCode, opts = {}) {
      const cc = countryCode.toUpperCase()
      const { rateType = 'standard', vatNumber } = opts

      // B2B reverse charge: EU customer with valid VAT number
      if (vatNumber && parseVatNumber(vatNumber)) {
        return {
          countryCode: cc,
          rateType: 'reverse_charge',
          rate: 0,
          taxAmount: 0,
          reverseCharge: true,
        }
      }

      if (!isEuCountry(cc)) {
        // Non-EU: export, no VAT
        return { countryCode: cc, rateType: 'exempt', rate: 0, taxAmount: 0, reverseCharge: false }
      }

      const rates = getRates(cc)!
      let rate: number

      if (rateType === 'super_reduced') {
        rate = rates.superReduced ?? rates.reduced
      } else if (rateType === 'reduced') {
        rate = rates.reduced
      } else {
        rate = rates.standard
      }

      const taxAmount = Math.floor(subtotalCents * rate)

      return {
        countryCode: cc,
        rateType,
        rate,
        taxAmount,
        reverseCharge: false,
      }
    },

    validateVatNumber(vatNumber) {
      return validateVatNumberVies(vatNumber, { dryRun: config.dryRun })
    },
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-vat-eu',
      version: '0.0.0',
    }),
    service,
  )
}
