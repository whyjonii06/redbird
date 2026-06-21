import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Guest checkout (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE order_line_items, orders, cart_line_items, carts, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  async function createVariantAndCart() {
    await redbird.catalog.createProduct({ slug: 'mug', name: 'Mug', status: 'active' }, [
      { sku: 'MUG-1', name: 'Blue', priceAmount: 1500, priceCurrency: 'EUR' },
    ])
    const product = await redbird.catalog.getProductBySlug('mug')
    const variantId = product?.variants[0]?.id
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variantId, 1)
    return cart
  }

  it('creates a cart with customerEmail at creation time', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR', customerEmail: 'guest@example.com' })
    expect(cart.customerEmail).toBe('guest@example.com')
  })

  it('sets email on an existing cart', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    expect(cart.customerEmail).toBeNull()
    const updated = await redbird.cart.setEmail(cart.id, 'guest@example.com')
    expect(updated.customerEmail).toBe('guest@example.com')
  })

  it('creates an order from cart using cart.customerEmail when no email in input', async () => {
    const cart = await createVariantAndCart()
    await redbird.cart.setEmail(cart.id, 'guest@example.com')
    const order = await redbird.orders.createFromCart(cart.id, {})
    expect(order.customerEmail).toBe('guest@example.com')
    expect(order.customerId).toBeNull()
  })

  it('input.customerEmail overrides cart email', async () => {
    const cart = await createVariantAndCart()
    await redbird.cart.setEmail(cart.id, 'original@example.com')
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'override@example.com',
    })
    expect(order.customerEmail).toBe('override@example.com')
  })

  it('throws when neither cart nor input has email', async () => {
    const cart = await createVariantAndCart()
    await expect(redbird.orders.createFromCart(cart.id, {})).rejects.toThrow('email')
  })

  it('listByEmail returns all orders for a guest', async () => {
    const cart1 = await createVariantAndCart()
    await redbird.orders.createFromCart(cart1.id, { customerEmail: 'guest@example.com' })

    // Create a second order — need a fresh active cart
    await redbird.catalog.createProduct({ slug: 'cup', name: 'Cup', status: 'active' }, [
      { sku: 'CUP-1', name: 'Red', priceAmount: 1000, priceCurrency: 'EUR' },
    ])
    const p2 = await redbird.catalog.getProductBySlug('cup')
    const cart2 = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart2.id, p2?.variants[0]?.id, 1)
    await redbird.orders.createFromCart(cart2.id, { customerEmail: 'guest@example.com' })

    const orders = await redbird.orders.listByEmail('guest@example.com')
    expect(orders).toHaveLength(2)
    expect(orders.every((o) => o.customerEmail === 'guest@example.com')).toBe(true)
  })

  it('listByEmail returns empty array for unknown email', async () => {
    expect(await redbird.orders.listByEmail('nobody@example.com')).toHaveLength(0)
  })

  it('getByNumber works for guest order lookup', async () => {
    const cart = await createVariantAndCart()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'guest@example.com',
    })
    const found = await redbird.orders.getByNumber(order.number)
    expect(found?.customerEmail).toBe('guest@example.com')
  })
})
