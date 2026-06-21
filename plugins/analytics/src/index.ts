import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'

const ConfigSchema = z.object({
  provider: z.enum(['plausible', 'ga4', 'console']).default('console'),
  endpoint: z.string().url().optional(),
  siteId: z.string().optional(),
})

export type AnalyticsConfig = z.input<typeof ConfigSchema>

export type AnalyticsEvent = {
  readonly name: string
  readonly props: Readonly<Record<string, unknown>>
  readonly timestamp: number
}

export function analytics(input: AnalyticsConfig = {}) {
  const config = definePluginConfig(ConfigSchema, input)
  const log: AnalyticsEvent[] = []

  async function track(name: string, props: Record<string, unknown>): Promise<void> {
    const event: AnalyticsEvent = { name, props, timestamp: Date.now() }
    log.push(event)

    if (config.provider === 'console') {
      console.log(`[analytics] ${name}`, props)
      return
    }

    if (config.provider === 'plausible' && config.endpoint && config.siteId) {
      // Best-effort, fire-and-forget — never block core flow on analytics
      void fetch(`${config.endpoint}/api/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, domain: config.siteId, props }),
      }).catch(() => {})
    }

    // GA4 measurement protocol path could be added here
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-analytics',
      version: '0.0.0',
      hooks: {
        'product.viewed': ({ product }) =>
          track('product_view', { id: product.id, slug: product.slug, name: product.name }),
        'product.created': ({ product }) =>
          track('product_created', { id: product.id, slug: product.slug }),
        'cart.created': ({ cart }) => track('cart_started', { cartId: cart.id }),
        'cart.afterAddItem': ({ cart, lineItem }) =>
          track('add_to_cart', {
            cartId: cart.id,
            variantId: lineItem.variantId,
            quantity: lineItem.quantity,
            unitPrice: lineItem.unitPriceAmount,
          }),
        'cart.afterRemoveItem': ({ cart }) => track('remove_from_cart', { cartId: cart.id }),
        'order.created': ({ order }) =>
          track('order_created', {
            orderId: order.id,
            number: order.number,
            total: order.totalAmount,
            currency: order.currency,
          }),
        'order.paid': ({ order }) =>
          track('order_paid', { orderId: order.id, total: order.totalAmount }),
      },
    }),
    {
      /** Read the in-memory event log (for tests/debugging). */
      getLog: () => [...log],
      clearLog: () => {
        log.length = 0
      },
    },
  )
}
