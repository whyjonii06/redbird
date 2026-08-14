import type { PluginDefinition } from './plugins/types.js'

export type LoyaltyConfig = {
  readonly enabled?: boolean
  /** Points earned per 100 cents (i.e. per €1 of order total). Default: 1. */
  readonly earnRate?: number
  /** Cents per point when redeeming (e.g. 1 means 100 pts = €1). Default: 1. */
  readonly redeemRate?: number
}

/** Legal identity of the selling company — required for compliant invoices (Factur-X). */
export type SellerConfig = {
  /** Legal/trade name of the seller (Factur-X BT-27). */
  readonly name: string
  readonly address: {
    readonly line1: string
    readonly line2?: string
    readonly postalCode: string
    readonly city: string
    /** ISO 3166-1 alpha-2 country code, e.g. 'FR'. */
    readonly countryCode: string
  }
  /** VAT identifier, e.g. 'FR12345678901' (BT-31). */
  readonly vatNumber?: string
  /** Legal registration ID — SIREN/SIRET in France (BT-30). */
  readonly legalRegistrationId?: string
  /** Contact email shown on the invoice. */
  readonly email?: string
}

export type RedbirdConfig = {
  /** Postgres URL for production. Omit (or use `file:./path`) for PGlite. */
  readonly databaseUrl?: string
  readonly defaultCurrency: string
  /** Display name of the store — used in emails and the back office. */
  readonly storeName?: string | undefined
  readonly plugins?: ReadonlyArray<PluginDefinition>
  /** Name of the default payment provider (must match a registered plugin's name). */
  readonly defaultPaymentProvider?: string
  /** Name of the default email provider (must match a registered plugin's name). */
  readonly defaultEmailProvider?: string
  readonly loyalty?: LoyaltyConfig
  /** Email address to receive low stock alerts. If not set, no alert is sent. */
  readonly stockAlertEmail?: string
  /** Trigger a stock.low alert when available stock falls at or below this number. Default: 5 */
  readonly stockAlertThreshold?: number
  /** License key obtained from marketplace.redbird.dev */
  readonly licenseKey?: string
  /** Override license server URL (for testing). Defaults to https://api.redbird.dev */
  readonly licenseServerUrl?: string
  /** Seller legal identity — required to issue compliant (Factur-X) invoices. */
  readonly seller?: SellerConfig
  /** Public storefront URL (no trailing slash), e.g. "https://shop.example.com".
   * Used to build absolute URLs in /sitemap.xml. Sitemap is omitted without it. */
  readonly storefrontUrl?: string
}

export function defineConfig(config: RedbirdConfig): RedbirdConfig {
  return config
}
