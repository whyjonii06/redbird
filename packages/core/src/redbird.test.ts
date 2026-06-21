import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { definePlugin } from './plugins/index.js'
import { createRedbird } from './redbird.js'

describe('Redbird engine (integration)', () => {
  const events: string[] = []

  const trackingPlugin = definePlugin({
    name: 'tracking',
    hooks: {
      'product.created': ({ product }) => {
        events.push(`product.created:${product.slug}`)
      },
      'cart.created': ({ cart }) => {
        events.push(`cart.created:${cart.id.slice(0, 8)}`)
      },
      'cart.afterAddItem': ({ lineItem }) => {
        events.push(`cart.afterAddItem:${lineItem.quantity}`)
      },
    },
  })

  const redbird = createRedbird({
    defaultCurrency: 'EUR',
    plugins: [trackingPlugin],
  })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    events.length = 0
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  it('creates a product with a variant', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'oat-milk', name: 'Oat Milk 1L', status: 'active' },
      [{ sku: 'OAT-1L', name: 'Default', priceAmount: 299, priceCurrency: 'EUR' }],
    )

    expect(product.slug).toBe('oat-milk')
    expect(product.status).toBe('active')

    const fetched = await redbird.catalog.getProductBySlug('oat-milk')
    expect(fetched).not.toBeNull()
    expect(fetched?.variants).toHaveLength(1)
    expect(fetched?.variants[0]?.sku).toBe('OAT-1L')

    expect(events).toContain('product.created:oat-milk')
  })

  it('adds variants to a cart and computes subtotal', async () => {
    const product = await redbird.catalog.createProduct(
      { slug: 'espresso', name: 'Espresso 250g', status: 'active' },
      [{ sku: 'ESP-250', name: '250g', priceAmount: 1250, priceCurrency: 'EUR' }],
    )
    const fetched = await redbird.catalog.getProductBySlug('espresso')
    const variant = fetched?.variants[0]
    if (!variant) throw new Error('variant missing')

    const cart = await redbird.cart.create({ currency: 'EUR' })
    expect(cart.currency).toBe('EUR')

    await redbird.cart.addItem(cart.id, variant.id, 2)
    await redbird.cart.addItem(cart.id, variant.id, 3) // should merge

    const loaded = await redbird.cart.get(cart.id)
    expect(loaded?.lineItems).toHaveLength(1)
    expect(loaded?.lineItems[0]?.quantity).toBe(5)

    const subtotal = await redbird.cart.subtotal(cart.id)
    expect(subtotal).toEqual({ amount: 1250 * 5, currency: 'EUR' })

    expect(events).toContain('product.created:espresso')
    expect(events).toContain('cart.afterAddItem:5')

    // unused but verifies type integrity
    void product
  })

  it('rejects adding a variant with mismatched currency', async () => {
    await redbird.catalog.createProduct({ slug: 'mug', name: 'Mug', status: 'active' }, [
      { sku: 'MUG-USD', name: 'Default', priceAmount: 1000, priceCurrency: 'USD' },
    ])
    const fetched = await redbird.catalog.getProductBySlug('mug')
    const variant = fetched?.variants[0]
    if (!variant) throw new Error('variant missing')

    const cart = await redbird.cart.create({ currency: 'EUR' })

    await expect(redbird.cart.addItem(cart.id, variant.id, 1)).rejects.toThrow(
      /currency.*does not match/,
    )
  })

  it('removes items from a cart', async () => {
    await redbird.catalog.createProduct({ slug: 'tea', name: 'Tea', status: 'active' }, [
      { sku: 'TEA-1', name: 'Default', priceAmount: 500, priceCurrency: 'EUR' },
    ])
    const fetched = await redbird.catalog.getProductBySlug('tea')
    const variant = fetched?.variants[0]
    if (!variant) throw new Error('variant missing')

    const cart = await redbird.cart.create({ currency: 'EUR' })
    const lineItem = await redbird.cart.addItem(cart.id, variant.id, 1)

    await redbird.cart.removeItem(cart.id, lineItem.id)
    const loaded = await redbird.cart.get(cart.id)
    expect(loaded?.lineItems).toHaveLength(0)
  })
})
