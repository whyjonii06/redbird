import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { storeSettings } from '../db/schema.js'

const SETTINGS_KEY = 'currency_rates'

type StoredRates = {
  rates: Record<string, number>
  lastSyncedAt: string | null
}

export type CurrencyConfig = {
  /** The store's default currency — always rate 1 relative to itself. */
  base: string
  /** Currency code -> units of that currency per 1 unit of `base`. Excludes base. */
  rates: Record<string, number>
  /** When rates were last refreshed from the live FX source, or null if never / manually edited since. */
  lastSyncedAt: string | null
}

export type CurrencyService = {
  /** Supported currencies + their rate relative to the store's default currency. */
  getConfig(): Promise<CurrencyConfig>
  /** Replace the configured rates. Each rate must be > 0. Clears lastSyncedAt (this is a manual edit). */
  setRates(rates: Record<string, number>): Promise<void>
  /**
   * Refreshes rates for the currently-configured currencies from a live FX
   * source (Frankfurter, ECB-backed, no API key needed) — a no-op if no
   * currencies beyond the base are configured yet, since there's nothing to
   * fetch a rate *for*. Currencies the source doesn't recognize keep their
   * last known rate rather than being dropped.
   */
  syncLiveRates(): Promise<CurrencyConfig>
  /** Convert a minor-unit amount (cents) between two supported currencies. */
  convert(amount: number, from: string, to: string): Promise<number>
}

export function createCurrencyService(db: DbClient, defaultCurrency: string): CurrencyService {
  async function getStored(): Promise<StoredRates> {
    const row = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.key, SETTINGS_KEY),
    })
    const raw = row?.value as Record<string, unknown> | null
    if (!raw) return { rates: {}, lastSyncedAt: null }
    // Legacy shape: the stored value used to be a flat { CODE: rate } map.
    if (!('rates' in raw)) return { rates: raw as Record<string, number>, lastSyncedAt: null }
    return {
      rates: (raw.rates as Record<string, number> | undefined) ?? {},
      lastSyncedAt: (raw.lastSyncedAt as string | undefined) ?? null,
    }
  }

  async function saveStored(value: StoredRates): Promise<void> {
    await db
      .insert(storeSettings)
      .values({ key: SETTINGS_KEY, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: storeSettings.key,
        set: { value, updatedAt: new Date() },
      })
  }

  async function getConfig(): Promise<CurrencyConfig> {
    const stored = await getStored()
    return { base: defaultCurrency, rates: stored.rates, lastSyncedAt: stored.lastSyncedAt }
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
      await saveStored({ rates: rest, lastSyncedAt: null })
    },

    async syncLiveRates() {
      const stored = await getStored()
      const codes = Object.keys(stored.rates)
      if (codes.length === 0) return { base: defaultCurrency, ...stored }

      const url = `https://api.frankfurter.app/latest?from=${defaultCurrency}&to=${codes.join(',')}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Live FX rate fetch failed (${res.status})`)
      const data = (await res.json()) as { rates?: Record<string, number> }

      // Currencies Frankfurter doesn't recognize (e.g. some regional codes) just
      // keep their last known rate instead of being silently dropped.
      const merged = { ...stored.rates, ...(data.rates ?? {}) }
      const lastSyncedAt = new Date().toISOString()
      await saveStored({ rates: merged, lastSyncedAt })
      return { base: defaultCurrency, rates: merged, lastSyncedAt }
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
