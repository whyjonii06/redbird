import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Stock (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE stock_levels, order_line_items, orders, cart_line_items, carts, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  async function createVariant() {
    const _product = await redbird.catalog.createProduct(
      { slug: 'coffee', name: 'Coffee', status: 'active' },
      [{ sku: 'COF-1', name: '250g', priceAmount: 1200, priceCurrency: 'EUR' }],
    )
    const full = await redbird.catalog.getProductBySlug('coffee')
    return full?.variants[0]!
  }

  async function makeCartWithVariant(variantId: string, quantity = 1) {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variantId, quantity)
    return cart
  }

  // ---- set / get ----

  it('sets initial stock and retrieves it', async () => {
    const variant = await createVariant()
    const info = await redbird.stock.set(variant.id, 10)
    expect(info.available).toBe(10)
    expect(info.reserved).toBe(0)
    expect(info.committed).toBe(0)
    expect(info.onHand).toBe(10)
  })

  it('get returns null for variant with no stock entry', async () => {
    const variant = await createVariant()
    expect(await redbird.stock.get(variant.id)).toBeNull()
  })

  it('adjust adds to available', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 5)
    const info = await redbird.stock.adjust(variant.id, 3)
    expect(info.available).toBe(8)
  })

  it('adjust negative clamps at 0', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 2)
    const info = await redbird.stock.adjust(variant.id, -100)
    expect(info.available).toBe(0)
  })

  it('isAvailable returns true when sufficient stock', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 5)
    expect(await redbird.stock.isAvailable(variant.id, 3)).toBe(true)
    expect(await redbird.stock.isAvailable(variant.id, 5)).toBe(true)
  })

  it('isAvailable returns false when insufficient stock', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 2)
    expect(await redbird.stock.isAvailable(variant.id, 3)).toBe(false)
  })

  it('isAvailable returns true for unlimited variant (no entry)', async () => {
    const variant = await createVariant()
    expect(await redbird.stock.isAvailable(variant.id, 999)).toBe(true)
  })

  // ---- cart integration ----

  it('reserves stock when item added to cart', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    await makeCartWithVariant(variant.id, 3)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(7)
    expect(info?.reserved).toBe(3)
  })

  it('releases stock when item removed from cart', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 3)
    const full = await redbird.cart.get(cart.id)
    await redbird.cart.removeItem(cart.id, full?.lineItems[0]?.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(10)
    expect(info?.reserved).toBe(0)
  })

  it('releases stock when cart is cleared', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 4)
    await redbird.cart.clear(cart.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(10)
    expect(info?.reserved).toBe(0)
  })

  it('adjusts reservation when quantity updated', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 2)
    const full = await redbird.cart.get(cart.id)
    await redbird.cart.updateItemQuantity(cart.id, full?.lineItems[0]?.id, 5)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(5)
    expect(info?.reserved).toBe(5)
  })

  it('throws when adding more than available', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 2)
    await expect(makeCartWithVariant(variant.id, 5)).rejects.toThrow('Insufficient stock')
  })

  it('allows adding to cart when no stock entry (unlimited)', async () => {
    const variant = await createVariant()
    // No stock.set() call
    await expect(makeCartWithVariant(variant.id, 100)).resolves.not.toThrow()
  })

  // ---- order lifecycle ----

  it('commits stock on order.paid', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 3)
    const order = await redbird.orders.createFromCart(cart.id, { customerEmail: 'a@b.com' })
    expect((await redbird.stock.get(variant.id))?.reserved).toBe(3)
    await redbird.orders.markPaid(order.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.reserved).toBe(0)
    expect(info?.committed).toBe(3)
    expect(info?.available).toBe(7)
  })

  it('releases reserved stock on order.cancelled (pending)', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 3)
    const order = await redbird.orders.createFromCart(cart.id, { customerEmail: 'a@b.com' })
    await redbird.orders.cancel(order.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(10)
    expect(info?.reserved).toBe(0)
  })

  it('uncommits stock on order.cancelled (paid)', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 3)
    const order = await redbird.orders.createFromCart(cart.id, { customerEmail: 'a@b.com' })
    await redbird.orders.markPaid(order.id)
    await redbird.orders.cancel(order.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(10)
    expect(info?.committed).toBe(0)
  })

  it('uncommits stock on order.refunded', async () => {
    const variant = await createVariant()
    await redbird.stock.set(variant.id, 10)
    const cart = await makeCartWithVariant(variant.id, 3)
    const order = await redbird.orders.createFromCart(cart.id, { customerEmail: 'a@b.com' })
    await redbird.orders.markPaid(order.id)
    await redbird.orders.refund(order.id)
    const info = await redbird.stock.get(variant.id)
    expect(info?.available).toBe(10)
    expect(info?.committed).toBe(0)
  })
})
