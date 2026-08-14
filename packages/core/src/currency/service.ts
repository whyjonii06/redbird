import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { storeSettings } from '../db/schema.js'

const SETTINGS_KEY = 'currency_rates'

export type CurrencyConfig = {
  /** The store's default currency — always rate 1 relative to itself. */
  base: string
  /** Currency code -> units of that currency per 1 unit of `base`. Excludes base. */
  rates: Record<string, number>
}

export type CurrencyService = {
  /** Supported currencies + their rate relative to the store's default currency. */
  getConfig(): Promise<CurrencyConfig>
  /** Replace the configured rates. Each rate must be > 0. */
  setRates(rates: Record<string, number>): Promise<void>
  /** Convert a minor-unit amount (cents) between two supported currencies. */
  convert(amount: number, from: string, to: string): Promise<number>
}

export function createCurrencyService(db: DbClient, defaultCurrency: string): CurrencyService {
  async function getConfig(): Promise<CurrencyConfig> {
    const row = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.key, SETTINGS_KEY),
    })
    const rates = (row?.value as Record<string, number> | null) ?? {}
    return { base: defaultCurrency, rates }
  }

  return {
    getConfig,

    async setRates(rates) {
      for (const [code, rate] of Object.entries(rates)) {
        if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid currency code: ${code}`)
        if (!(rate > 0)) throw new Error(`Rate for ${code} must be greater than 0`)
      }
      // The base currency is implicit (rate 1) — never store it as an explicit rate,
      // it would just be redundant state that could drift out of sync.
      const { [defaultCurrency]: _base, ...rest } = rates
      await db
        .insert(storeSettings)
        .values({ key: SETTINGS_KEY, value: rest, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: { value: rest, updatedAt: new Date() },
        })
    },

    async convert(amount, from, to) {
      if (from === to) return amount
      const { base, rates } = await getConfig()
      const rateOf = (code: string): number => {
        if (code === base) return 1
        const r = rates[code]
        if (!r) throw new Error(`No exchange rate configured for ${code}`)
        return r
      }
      // amount (in `from`) -> base units -> `to` units
      const inBase = amount / rateOf(from)
      return Math.round(inBase * rateOf(to))
    },
  }
}
