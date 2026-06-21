import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

describe('order service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await rb.init()
  })

  beforeEach(async () => {
    await rb.db.execute(
      sql`TRUNCATE TABLE order_line_items, orders, cart_line_items, carts, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await rb.close()
  })

  async function createVariant(priceAmount = 2000) {
    const slug = 'prod-' + randomUUID().slice(0, 8)
    await rb.catalog.createProduct({ slug, name: slug, status: 'active' }, [
      { sku: slug + '-1', name: 'Default', priceAmount, priceCurrency: 'EUR' },
    ])
    const product = await rb.catalog.getProductBySlug(slug)
    const variant = product?.variants[0]
    if (!variant) throw new Error('variant missing')
    return variant
  }

  async function makeCart(variantId: string, qty = 1, email = 'test@example.com') {
    const cart = await rb.cart.create({ currency: 'EUR' })
    await rb.cart.setEmail(cart.id, email)
    await rb.cart.addItem(cart.id, variantId, qty)
    return cart.id
  }

  it('createFromCart builds order with correct totals', async () => {
    const variant = await createVariant(2500)
    const cartId = await makeCart(variant.id, 2)

    const order = await rb.orders.createFromCart(cartId, {
      customerEmail: 'buyer@example.com',
      shippingAmount: 500,
    })

    expect(order.subtotalAmount).toBe(5000)
    expect(order.shippingAmount).toBe(500)
    expect(order.totalAmount).toBe(5500)
    expect(order.currency).toBe('EUR')
    expect(order.status).toBe('pending')
    expect(order.lineItems).toHaveLength(1)
    expect(order.lineItems[0]?.quantity).toBe(2)
  })

  it('createFromCart uses email set on cart', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id, 1, 'cart@example.com')

    const order = await rb.orders.createFromCart(cartId, {})
    expect(order.customerEmail).toBe('cart@example.com')
  })

  it('createFromCart throws on empty cart', async () => {
    const cart = await rb.cart.create({ currency: 'EUR' })
    await expect(
      rb.orders.createFromCart(cart.id, { customerEmail: 'a@a.com' }),
    ).rejects.toThrow(/empty/)
  })

  it('cart is set to checked_out after order creation', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)

    await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const cart = await rb.cart.get(cartId)
    expect(cart?.status).toBe('checked_out')
  })

  it('markPaid transitions status to paid', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const paid = await rb.orders.markPaid(order.id)
    expect(paid.status).toBe('paid')
  })

  it('markFulfilled transitions paid → fulfilled', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })
    await rb.orders.markPaid(order.id)

    const fulfilled = await rb.orders.markFulfilled(order.id)
    expect(fulfilled.status).toBe('fulfilled')
  })

  it('cancel from pending → cancelled', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const cancelled = await rb.orders.cancel(order.id)
    expect(cancelled.status).toBe('cancelled')
  })

  it('refund from paid → refunded', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })
    await rb.orders.markPaid(order.id)

    const refunded = await rb.orders.refund(order.id)
    expect(refunded.status).toBe('refunded')
  })

  it('refund from pending throws invalid transition', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    await expect(rb.orders.refund(order.id)).rejects.toThrow(/Cannot transition/)
  })

  it('markFulfilled from pending throws invalid transition', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    await expect(rb.orders.markFulfilled(order.id)).rejects.toThrow(/Cannot transition/)
  })

  it('setTracking stores tracking info', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const tracked = await rb.orders.setTracking(
      order.id,
      'TRACK123',
      'https://example.com/track/TRACK123',
    )
    expect(tracked.trackingNumber).toBe('TRACK123')
    expect(tracked.trackingUrl).toBe('https://example.com/track/TRACK123')
  })

  it('addNote appends timestamped note', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const noted = await rb.orders.addNote(order.id, 'handle with care')
    expect(noted.notes).toMatch(/handle with care/)
  })

  it('getByNumber finds order by number', async () => {
    const variant = await createVariant()
    const cartId = await makeCart(variant.id)
    const order = await rb.orders.createFromCart(cartId, { customerEmail: 'x@x.com' })

    const found = await rb.orders.getByNumber(order.number)
    expect(found?.id).toBe(order.id)
  })

  it('listByEmail returns only orders for that email', async () => {
    const variant = await createVariant()

    const cart1 = await makeCart(variant.id, 1, 'alice@example.com')
    const cart2 = await makeCart(variant.id, 1, 'bob@example.com')
    await rb.orders.createFromCart(cart1, { customerEmail: 'alice@example.com' })
    await rb.orders.createFromCart(cart2, { customerEmail: 'bob@example.com' })

    const aliceOrders = await rb.orders.listByEmail('alice@example.com')
    expect(aliceOrders).toHaveLength(1)
    expect(aliceOrders[0]?.customerEmail).toBe('alice@example.com')
  })

  it('get returns null for unknown order id', async () => {
    const result = await rb.orders.get(randomUUID())
    expect(result).toBeNull()
  })
})
