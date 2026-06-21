import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

describe('cart service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await rb.init()
  })

  beforeEach(async () => {
    await rb.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await rb.close()
  })

  async function createVariant(
    slug: string,
    priceAmount = 1000,
    priceCurrency = 'EUR',
  ) {
    await rb.catalog.createProduct({ slug, name: slug, status: 'active' }, [
      { sku: `${slug}-1`, name: 'Default', priceAmount, priceCurrency },
    ])
    const product = await rb.catalog.getProductBySlug(slug)
    const variant = product?.variants[0]
    if (!variant) throw new Error('variant missing')
    return variant
  }

  it('updateItemQuantity changes quantity', async () => {
    const variant = await createVariant('item-qty-' + randomUUID().slice(0, 8))
    const cart = await rb.cart.create({ currency: 'EUR' })
    const li = await rb.cart.addItem(cart.id, variant.id, 2)

    const updated = await rb.cart.updateItemQuantity(cart.id, li.id, 5)
    expect(updated.quantity).toBe(5)

    const loaded = await rb.cart.get(cart.id)
    expect(loaded?.lineItems[0]?.quantity).toBe(5)
  })

  it('clear removes all line items', async () => {
    const v1 = await createVariant('clear-a-' + randomUUID().slice(0, 8))
    const v2 = await createVariant('clear-b-' + randomUUID().slice(0, 8))
    const cart = await rb.cart.create({ currency: 'EUR' })
    await rb.cart.addItem(cart.id, v1.id, 1)
    await rb.cart.addItem(cart.id, v2.id, 3)

    await rb.cart.clear(cart.id)

    const loaded = await rb.cart.get(cart.id)
    expect(loaded?.lineItems).toHaveLength(0)
  })

  it('setEmail associates an email with the cart', async () => {
    const cart = await rb.cart.create({ currency: 'EUR' })
    const updated = await rb.cart.setEmail(cart.id, 'guest@example.com')
    expect(updated.customerEmail).toBe('guest@example.com')
  })

  it('get returns null for unknown id', async () => {
    const result = await rb.cart.get(randomUUID())
    expect(result).toBeNull()
  })

  it('subtotal on empty cart returns 0', async () => {
    const cart = await rb.cart.create({ currency: 'EUR' })
    const result = await rb.cart.subtotal(cart.id)
    expect(result).toEqual({ amount: 0, currency: 'EUR' })
  })

  it('updateItemQuantity to 0 throws', async () => {
    const variant = await createVariant('qty-zero-' + randomUUID().slice(0, 8))
    const cart = await rb.cart.create({ currency: 'EUR' })
    const li = await rb.cart.addItem(cart.id, variant.id, 2)
    await expect(rb.cart.updateItemQuantity(cart.id, li.id, 0)).rejects.toThrow(/Quantity/)
  })
})
