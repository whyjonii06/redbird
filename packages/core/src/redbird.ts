import { eq } from 'drizzle-orm'
import { type AbandonedCartService, createAbandonedCartService } from './abandoned-cart/service.js'
import { type AddressService, createAddressService } from './addresses/service.js'
import { type AttributeService, createAttributeService } from './attributes/service.js'
import { type AuditLogService, createAuditLogService } from './audit-log/service.js'
import { type BrandService, createBrandService } from './brands/service.js'
import { type CampaignService, createCampaignService } from './campaigns/service.js'
import { type CartService, createCartService } from './cart/service.js'
import { type CategoryService, createCategoryService } from './catalog/categories.js'
import { type ProductFeatureService, createProductFeatureService } from './catalog/features.js'
import { type ImageService, createImageService } from './catalog/images.js'
import { type CatalogService, createCatalogService } from './catalog/service.js'
import { type CmsService, createCmsService } from './cms/service.js'
import type { RedbirdConfig } from './config.js'
import { type CurrencyService, createCurrencyService } from './currency/service.js'
import { type CustomerGroupService, createCustomerGroupService } from './customer-groups/service.js'
import { type CustomerService, createCustomerService } from './customer/service.js'
import { type DbClient, createDbClient, isPgliteUrl } from './db/client.js'
import { runPostgresMigrations } from './db/migrate-pg.js'
import { runPgliteMigrations } from './db/migrate-pglite.js'
import { productVariants } from './db/schema.js'
import { type DownloadService, createDownloadService } from './downloads/service.js'
import { EmailRegistry } from './email/registry.js'
import type { EmailProvider, LocalEmailStore } from './email/types.js'
import { type FeatureFlagService, createFeatureFlagService } from './feature-flags/service.js'
import { type GiftCardService, createGiftCardService } from './gift-cards/service.js'
import { type CategoryI18nService, createCategoryI18nService } from './i18n/category-service.js'
import { type CmsI18nService, createCmsI18nService } from './i18n/cms-service.js'
import { type I18nService, createI18nService } from './i18n/service.js'
import type { LicenseInfo } from './license/types.js'
import { verifyLicense } from './license/verify.js'
import { type LoyaltyService, createLoyaltyService } from './loyalty/service.js'
import { type OrderService, createOrderService } from './order/service.js'
import { type PaymentMethodService, createPaymentMethodService } from './payment-methods/service.js'
import { PaymentRegistry } from './payments/registry.js'
import type { PaymentProvider } from './payments/types.js'
import { PluginRegistry } from './plugins/registry.js'
import type { PluginDefinition } from './plugins/types.js'
import { type PosService, createPosService } from './pos/service.js'
import { type PromoService, createPromoService } from './promos/service.js'
import { type QuoteService, createQuoteService } from './quotes/service.js'
import { type RedirectService, createRedirectService } from './redirects/service.js'
import { type ReturnService, createReturnService } from './returns/service.js'
import { type SearchService, createSearchService } from './search/service.js'
import { ShippingRegistry } from './shipping/registry.js'
import type { ShippingProvider } from './shipping/types.js'
import { type StaffService, createStaffService } from './staff/service.js'
import { type StockService, createStockService } from './stock/service.js'
import { type SubscriptionService, createSubscriptionService } from './subscriptions/service.js'
import { type SupplierService, createSupplierService } from './suppliers/service.js'
import { TaxRegistry } from './tax/registry.js'
import type { TaxProvider } from './tax/types.js'
import { type ThemeSectionService, createThemeSectionService } from './theme-sections/service.js'
import { type WarehouseService, createWarehouseService } from './warehouses/service.js'
import { type WebhookService, createWebhookService } from './webhooks/service.js'

export type Redbird = {
  readonly db: DbClient
  readonly config: RedbirdConfig
  readonly catalog: CatalogService
  readonly categories: CategoryService
  readonly images: ImageService
  readonly cart: CartService
  readonly orders: OrderService
  readonly customers: CustomerService
  readonly paymentMethods: PaymentMethodService
  readonly quotes: QuoteService
  readonly pos: PosService
  readonly plugins: PluginRegistry
  readonly payments: PaymentRegistry
  readonly email: EmailRegistry
  readonly taxes: TaxRegistry
  readonly shipping: ShippingRegistry
  readonly stock: StockService
  readonly promos: PromoService
  readonly i18n: I18nService
  readonly categoryI18n: CategoryI18nService
  readonly cmsI18n: CmsI18nService
  readonly returns: ReturnService
  readonly abandonedCart: AbandonedCartService
  readonly staff: StaffService
  readonly attributes: AttributeService
  readonly auditLog: AuditLogService
  readonly currency: CurrencyService
  readonly warehouses: WarehouseService
  readonly search: SearchService
  readonly redirects: RedirectService
  readonly cms: CmsService
  readonly themeSections: ThemeSectionService
  readonly addresses: AddressService
  readonly brands: BrandService
  readonly suppliers: SupplierService
  readonly downloads: DownloadService
  readonly loyalty: LoyaltyService
  readonly giftCards: GiftCardService
  readonly webhooks: WebhookService
  readonly productFeatures: ProductFeatureService
  readonly customerGroupsSvc: CustomerGroupService
  readonly featureFlags: FeatureFlagService
  readonly campaigns: CampaignService
  readonly subscriptions: SubscriptionService
  readonly localEmails: LocalEmailStore | null
  /** Mutable at runtime — admin.config.update can change these without a server restart. */
  readonly stockAlertConfig: { email: string | undefined; threshold: number }
  readonly loyaltyConfig: { enabled: boolean; earnRate: number; redeemRate: number }
  readonly license: LicenseInfo | null
  /** Hot-register a plugin at runtime (no restart needed). Dispatches to all relevant registries. */
  installPlugin(plugin: unknown): void
  /** Verify a new license key and update the in-memory license info immediately. */
  reloadLicense(key: string): Promise<LicenseInfo | null>
  /** Run plugin setup hooks and (for PGlite) apply migrations. Call once after createRedbird. */
  init(): Promise<void>
  /** Close the database connection or PGlite instance. */
  close(): Promise<void>
}

export function createRedbird(config: RedbirdConfig): Redbird {
  const db = createDbClient(config.databaseUrl)
  const plugins = new PluginRegistry()
  const payments = new PaymentRegistry()
  const email = new EmailRegistry()
  const taxes = new TaxRegistry()
  const shippingReg = new ShippingRegistry()

  for (const plugin of config.plugins ?? []) {
    plugins.register(plugin as PluginDefinition)
    if ('createPaymentIntent' in plugin && typeof plugin.createPaymentIntent === 'function') {
      payments.register(plugin as unknown as PaymentProvider)
    }
    if ('send' in plugin && typeof plugin.send === 'function') {
      email.register(plugin as unknown as EmailProvider)
    }
    if ('calculate' in plugin && typeof plugin.calculate === 'function') {
      // Detect shipping plugins by name to avoid confusing them with tax plugins
      const pluginName = (plugin as { name?: string }).name ?? ''
      if (pluginName.includes('shipping')) {
        shippingReg.register(plugin as unknown as ShippingProvider)
      } else {
        taxes.register(plugin as unknown as TaxProvider)
      }
    }
  }

  let licenseInfo: LicenseInfo | null = null

  // Detect local email plugin for backoffice mailbox
  let localEmailStore: LocalEmailStore | null = null
  for (const plugin of config.plugins ?? []) {
    if (
      'store' in plugin &&
      plugin.store &&
      typeof (plugin.store as { list?: unknown }).list === 'function'
    ) {
      localEmailStore = plugin.store as LocalEmailStore
      break
    }
  }

  if (config.defaultPaymentProvider) {
    payments.setDefault(config.defaultPaymentProvider)
  }

  if (config.defaultEmailProvider) {
    email.setDefault(config.defaultEmailProvider)
  }

  // Auto-register console email logger if no email provider configured
  if (email.list().length === 0) {
    email.register({
      name: '@redbird/email-console',
      async send(msg) {
        const to = Array.isArray(msg.to) ? msg.to.join(', ') : msg.to
        const line = '─'.repeat(60)
        console.log(`\n${line}`)
        console.log(`📧  EMAIL (console fallback — configure a real provider)`)
        console.log(`    To:      ${to}`)
        console.log(`    Subject: ${msg.subject}`)
        if (msg.text) {
          const preview = msg.text.slice(0, 200).replace(/\n/g, ' ')
          console.log(`    Preview: ${preview}${msg.text.length > 200 ? '…' : ''}`)
        }
        console.log(line + '\n')
      },
    })
  }

  const stockAlertConfig = {
    email: config.stockAlertEmail,
    threshold: config.stockAlertThreshold ?? 5,
  }

  const stockSvc = createStockService(db)
  const promoSvc = createPromoService(db)
  const i18nSvc = createI18nService(db)
  const categoryI18nSvc = createCategoryI18nService(db)
  const cmsI18nSvc = createCmsI18nService(db)
  const abandonedCartSvc = createAbandonedCartService(db, email)
  const staffSvc = createStaffService(db)
  const attributeSvc = createAttributeService(db)
  const auditLogSvc = createAuditLogService(db)
  const currencySvc = createCurrencyService(db, config.defaultCurrency)
  const warehouseSvc = createWarehouseService(db)
  const redirectSvc = createRedirectService(db)
  const cmsSvc = createCmsService(db)
  const themeSectionSvc = createThemeSectionService(db)
  const searchSvc = createSearchService(config.search)
  const catalog = createCatalogService(db, plugins, searchSvc)

  // Keep the search index in sync with the catalog — an interceptor rather than a
  // proper hook handler so a Meilisearch hiccup can never fail the product write
  // itself (onEmit interceptor errors are always swallowed by the registry).
  if (searchSvc.enabled) {
    plugins.onEmit(async (name, ctx) => {
      if (name === 'product.created' || name === 'product.updated') {
        const { product } = ctx as { product: { id: string } }
        const full = await catalog.getProductById(product.id)
        if (full) await searchSvc.indexProduct(full)
      } else if (name === 'product.deleted') {
        const { productId } = ctx as { productId: string }
        await searchSvc.deleteProduct(productId)
      } else if (name === 'variant.created' || name === 'variant.updated') {
        const { variant } = ctx as { variant: { productId: string } }
        const full = await catalog.getProductById(variant.productId)
        if (full) await searchSvc.indexProduct(full)
      }
    })
  }
  const categorySvc = createCategoryService(db, plugins)
  const imageSvc = createImageService(db)
  const customerGroupSvc = createCustomerGroupService(db)
  const featureFlagSvc = createFeatureFlagService(db)
  const campaignSvc = createCampaignService(db, email)
  const cart = createCartService(db, plugins, stockSvc, currencySvc, customerGroupSvc)
  const orderSvc = createOrderService(db, plugins, stockSvc, payments, cart)
  const subscriptionSvc = createSubscriptionService(db, email, cart, orderSvc, payments)
  const returnSvc = createReturnService(db, orderSvc, stockSvc)
  const customerSvc = createCustomerService(db)
  const paymentMethodSvc = createPaymentMethodService(db, payments)
  const quoteSvc = createQuoteService(db, cart)
  const posSvc = createPosService(db, cart, orderSvc, config.defaultCurrency)
  const addressSvc = createAddressService(db)
  const brandSvc = createBrandService(db)
  const supplierSvc = createSupplierService(db)
  const downloadSvc = createDownloadService(db)
  const loyaltySvc = createLoyaltyService(db)
  const giftCardSvc = createGiftCardService(db)
  const webhookSvc = createWebhookService(db)
  const productFeatureSvc = createProductFeatureService(db)

  // Forward every plugin event to registered webhook endpoints (fire-and-forget)
  plugins.onEmit((event, payload) => webhookSvc.dispatch(event, payload))

  // Internal hook: stock alerts
  plugins.onEmit(async (name, ctx) => {
    if (name !== 'order.created') return
    const alertEmail = stockAlertConfig.email
    if (!alertEmail) return

    const threshold = stockAlertConfig.threshold
    const order = (ctx as { lineItems?: ReadonlyArray<{ variantId: string }> }).lineItems

    if (!order) return

    // Check stock for each ordered variant
    const variantIds = [...new Set(order.map((li) => li.variantId))]
    for (const variantId of variantIds) {
      const level = await stockSvc.get(variantId)
      if (level === null || level.available > threshold) continue

      // Find product info for the alert
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
        with: { product: { columns: { name: true, id: true } } },
      })
      if (!variant) continue

      const productName = variant.product?.name ?? 'Unknown product'
      const variantName = variant.name ?? variantId

      // Emit the stock.low hook
      await plugins.emit('stock.low', {
        variantId,
        available: level.available,
        productId: variant.productId,
        productName,
        variantName,
      })

      // Send alert email
      const provider = email.default()
      if (!provider) continue

      const storeName = config.storeName ?? 'Store'
      await provider.send({
        to: alertEmail,
        subject: `⚠️ Low stock alert — ${productName} (${variantName})`,
        html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
          <h2 style="margin:0 0 16px">${storeName} — Low stock alert</h2>
          <p>The following product is running low:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;font-weight:600">Product</td><td style="padding:8px">${productName}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;font-weight:600">Variant</td><td style="padding:8px">${variantName}</td></tr>
            <tr><td style="padding:8px;font-weight:600">Stock left</td><td style="padding:8px;color:${level.available === 0 ? '#dc2626' : '#d97706'}">${level.available}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:14px">Replenish your stock to avoid missed sales.</p>
        </div>
      `,
        text: `Low stock alert for ${productName} (${variantName}): ${level.available} units left.`,
      })
    }
  })

  const loyaltyConfigInput = config.loyalty ?? {}
  // Mutable — admin.config.update can change these without a server restart,
  // same pattern as stockAlertConfig. Every reader below closes over this same
  // object, so a runtime edit takes effect immediately for all of them.
  const loyaltyConfig = {
    enabled: loyaltyConfigInput.enabled !== false,
    earnRate: loyaltyConfigInput.earnRate ?? 1,
    redeemRate: loyaltyConfigInput.redeemRate ?? 1,
  }

  // Internal hook: auto-generate download tokens + earn loyalty points when an order is paid
  plugins.register({
    name: '__redbird.downloads',
    hooks: {
      'order.paid': async ({ order }) => {
        await downloadSvc.generateTokensForOrder(order.id)
        if (loyaltyConfig.enabled && order.customerId) {
          await loyaltySvc.earn(
            order.customerId,
            order.id,
            order.totalAmount,
            loyaltyConfig.earnRate,
          )
        }
      },
    },
  })

  return {
    db,
    config,
    catalog,
    categories: categorySvc,
    images: imageSvc,
    cart,
    orders: orderSvc,
    customers: customerSvc,
    paymentMethods: paymentMethodSvc,
    quotes: quoteSvc,
    pos: posSvc,
    plugins,
    payments,
    email,
    taxes,
    shipping: shippingReg,
    stock: stockSvc,
    promos: promoSvc,
    i18n: i18nSvc,
    categoryI18n: categoryI18nSvc,
    cmsI18n: cmsI18nSvc,
    returns: returnSvc,
    abandonedCart: abandonedCartSvc,
    staff: staffSvc,
    attributes: attributeSvc,
    auditLog: auditLogSvc,
    currency: currencySvc,
    warehouses: warehouseSvc,
    search: searchSvc,
    redirects: redirectSvc,
    cms: cmsSvc,
    themeSections: themeSectionSvc,
    addresses: addressSvc,
    brands: brandSvc,
    suppliers: supplierSvc,
    downloads: downloadSvc,
    loyalty: loyaltySvc,
    giftCards: giftCardSvc,
    webhooks: webhookSvc,
    productFeatures: productFeatureSvc,
    customerGroupsSvc: customerGroupSvc,
    featureFlags: featureFlagSvc,
    campaigns: campaignSvc,
    subscriptions: subscriptionSvc,
    get localEmails() {
      return localEmailStore
    },
    stockAlertConfig,
    loyaltyConfig,
    get license() {
      return licenseInfo
    },
    async reloadLicense(key: string) {
      if (!key) {
        licenseInfo = null
        return null
      }
      licenseInfo = await verifyLicense(key, config.licenseServerUrl)
      return licenseInfo
    },
    installPlugin(plugin: unknown) {
      const p = plugin as Record<string, unknown>
      plugins.register(plugin as PluginDefinition)
      if (typeof p.send === 'function') {
        email.register(plugin as unknown as EmailProvider)
        // Replace console fallback as default when a real provider is installed
        const currentDefault = email.default()
        if (!currentDefault || currentDefault.name === '@redbird/email-console') {
          email.setDefault(p.name as string)
        }
        // If this is the local email plugin, expose its store
        if ('store' in p && p.store && typeof (p.store as { list?: unknown }).list === 'function') {
          localEmailStore = p.store as LocalEmailStore
        }
      }
      if (typeof p.createPaymentIntent === 'function') {
        payments.register(plugin as unknown as PaymentProvider)
      }
      if (typeof p.calculate === 'function') {
        const name = (p.name as string | undefined) ?? ''
        if (name.includes('shipping')) shippingReg.register(plugin as unknown as ShippingProvider)
        else taxes.register(plugin as unknown as TaxProvider)
      }
    },
    async init() {
      if (isPgliteUrl(config.databaseUrl)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await runPgliteMigrations(db as any)
      } else {
        await runPostgresMigrations(db)
      }
      await plugins.setupAll(db)
      if (searchSvc.enabled) {
        try {
          await searchSvc.ensureIndex()
        } catch (err) {
          console.warn('⚠ Search index setup failed — falling back to plain DB search.', err)
        }
      }
      // Verify license if key provided
      if (config.licenseKey) {
        licenseInfo = await verifyLicense(config.licenseKey, config.licenseServerUrl)
        if (licenseInfo?.valid) {
          console.log(
            `✓ Redbird license verified — plan: ${licenseInfo.plan} (${licenseInfo.email})`,
          )
        } else if (config.licenseKey) {
          console.warn(
            '⚠ Redbird license key provided but could not be verified. Running in unlicensed mode.',
          )
        }
      }
    },
    async close() {
      const client = db.$client as { end?: () => Promise<void>; close?: () => Promise<void> }
      await (client.end?.() ?? client.close?.())
    },
  }
}
