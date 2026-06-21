/**
 * Integration test — all 4 first-party plugins wired into a real Redbird instance.
 * Validates the full chain: definePlugin → registry → emit → handler with DB access.
 */
import { createRedbird } from '@redbirdshop/core'
import { analytics } from '@redbird/plugin-analytics'
import { paypal } from '@redbird/plugin-paypal'
import { reviews } from '@redbird/plugin-reviews'
import { shippingFlat } from '@redbird/plugin-shipping-flat'
import { stripe } from '@redbird/plugin-stripe'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Plugins (integration)', () => {
  const shipping = shippingFlat({
    zones: [{ name: 'France', countries: ['FR'], rateAmount: 590, rateCurrency: 'EUR' }],
  })
  const reviewsPlugin = reviews()
  const analyticsPlugin = analytics({ provider: 'console' })
  const stripePlugin = stripe({ secretKey: 'sk_test_demo', dryRun: true })
  const paypalPlugin = paypal({
    clientId: 'demo_client',
    clientSecret: 'demo_secret',
    sandbox: true,
    dryRun: true,
  })

  const redbird = createRedbird({
    defaultCurrency: 'EUR',
    defaultPaymentProvider: '@redbird/plugin-paypal',
    plugins: [shipping, reviewsPlugin, analyticsPlugin, stripePlugin, paypalPlugin],
  })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    analyticsPlugin.clearLog()
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  it('all plugins register and setup runs without error', () => {
    expect(redbird.plugins.has('@redbird/plugin-shipping-flat')).toBe(true)
    expect(redbird.plugins.has('@redbird/plugin-analytics')).toBe(true)
    expect(redbird.plugins.has('@redbird/plugin-reviews')).toBe(true)
    expect(redbird.plugins.has('@redbird/plugin-stripe')).toBe(true)
    expect(redbird.plugins.has('@redbird/plugin-paypal')).toBe(true)
  })

  it('analytics plugin captures cart events via hooks', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'beans', name: 'Beans', status: 'active' },
      [{ sku: 'B-1', name: 'Default', priceAmount: 1000, priceCurrency: 'EUR' }],
    )
    const fetched = await redbird.catalog.getProductBySlug('beans')
    const variantId = fetched?.variants[0]?.id ?? ''

    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variantId, 3)

    const events = analyticsPlugin.getLog().map((e) => e.name)
    expect(events).toContain('product_created')
    expect(events).toContain('cart_started')
    expect(events).toContain('add_to_cart')
    void product
  })

  it('shipping-flat computes a rate', () => {
    const rate = shipping.calculate('FR', 1000, 'EUR')
    expect(rate.zone).toBe('France')
    expect(rate.amount).toBe(590)
  })

  it('stripe plugin creates a dry-run PaymentIntent', async () => {
    const intent = await stripePlugin.createPaymentIntent({ amount: 1990, currency: 'EUR' })
    expect(intent.id).toMatch(/^pi_demo_/)
    expect(intent.amount).toBe(1990)
    expect(intent.currency).toBe('eur')
  })

  it('paypal plugin creates a dry-run PaymentIntent', async () => {
    const intent = await paypalPlugin.createPaymentIntent({ amount: 2490, currency: 'EUR' })
    expect(intent.id).toMatch(/^paypal_demo_/)
    expect(intent.amount).toBe(2490)
    expect(intent.currency).toBe('EUR')
    expect(intent.provider).toBe('@redbird/plugin-paypal')
  })

  it('PaymentRegistry resolves the default and named providers', () => {
    expect(redbird.payments.defaultName).toBe('@redbird/plugin-paypal')
    expect(redbird.payments.default()?.name).toBe('@redbird/plugin-paypal')
    expect(redbird.payments.get('@redbird/plugin-stripe')?.name).toBe('@redbird/plugin-stripe')
    expect(redbird.payments.list()).toHaveLength(2)
  })

  it('rejects empty PayPal clientId at config time', () => {
    expect(() =>
      paypal({ clientId: '', clientSecret: 'secret', sandbox: true, dryRun: true }),
    ).toThrow(/client ID is required/)
  })

  it('reviews plugin provisions its own table and supports CRUD', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'reviewable', name: 'Reviewable', status: 'active' },
      [{ sku: 'R-1', name: 'Default', priceAmount: 500, priceCurrency: 'EUR' }],
    )

    const r1 = await reviewsPlugin.create({
      productId: product.id,
      customerName: 'Alice',
      rating: 5,
      comment: 'Excellent',
    })
    await reviewsPlugin.create({
      productId: product.id,
      customerName: 'Bob',
      rating: 4,
    })

    const list = await reviewsPlugin.list(product.id)
    expect(list).toHaveLength(2)
    expect(list.map((r) => r.customerName)).toContain('Bob')
    expect(list.map((r) => r.customerName)).toContain('Alice')
    expect(r1.rating).toBe(5)

    const stats = await reviewsPlugin.averageRating(product.id)
    expect(stats.count).toBe(2)
    expect(stats.average).toBeCloseTo(4.5, 1)
  })

  it('reviews plugin cleans up when product is deleted', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'doomed', name: 'Doomed', status: 'active' },
      [{ sku: 'D-1', name: 'Default', priceAmount: 100, priceCurrency: 'EUR' }],
    )
    await reviewsPlugin.create({ productId: product.id, customerName: 'X', rating: 3 })

    await redbird.catalog.deleteProduct(product.id)

    const list = await reviewsPlugin.list(product.id)
    expect(list).toHaveLength(0)
  })

  it('rejects invalid stripe secret key at config time', () => {
    expect(() => stripe({ secretKey: 'bogus' })).toThrow(/sk_test_ or sk_live_/)
  })

  it('rejects invalid review rating', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'rate-fail', name: 'Rate', status: 'active' },
      [{ sku: 'RF-1', name: 'Default', priceAmount: 100, priceCurrency: 'EUR' }],
    )
    await expect(
      reviewsPlugin.create({ productId: product.id, customerName: 'Z', rating: 6 }),
    ).rejects.toThrow(/1..5/)
  })
})
