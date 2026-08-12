import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Checkout (integration)', () => {
  const redbird = createRedbird({
    defaultCurrency: 'EUR',
  })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  async function seedCartWithItems() {
    const product = await redbird.catalog.createProduct(
      { slug: 'coffee-250g', name: 'Ethiopian Coffee', status: 'active' },
      [
        { sku: 'COF-250', name: '250g', priceAmount: 1490, priceCurrency: 'EUR' },
        { sku: 'COF-500', name: '500g', priceAmount: 2490, priceCurrency: 'EUR' },
      ],
    )
    const p = await redbird.catalog.getProductBySlug('coffee-250g')
    const v1 = p?.variants.find((v) => v.sku === 'COF-250')!
    const v2 = p?.variants.find((v) => v.sku === 'COF-500')!

    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, v1.id, 2)
    await redbird.cart.addItem(cart.id, v2.id, 1)

    return { cart, product, v1, v2 }
  }

  it('creates an order from a cart and snapshots line items', async () => {
    const { cart, v1, v2 } = await seedCartWithItems()

    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'alice@example.com',
    })

    expect(order.status).toBe('pending')
    expect(order.customerEmail).toBe('alice@example.com')
    expect(order.currency).toBe('EUR')
    expect(order.subtotalAmount).toBe(v1.priceAmount * 2 + v2.priceAmount * 1)
    expect(order.totalAmount).toBe(order.subtotalAmount)
    expect(order.number).toMatch(/^ORD-\d{8}-[0-9A-F]{6}$/)

    expect(order.lineItems).toHaveLength(2)
    const li1 = order.lineItems.find((li) => li.sku === 'COF-250')
    expect(li1?.quantity).toBe(2)
    expect(li1?.productName).toBe('Ethiopian Coffee')
    expect(li1?.variantName).toBe('250g')
    expect(li1?.totalAmount).toBe(v1.priceAmount * 2)
  })

  it('marks the cart as checked_out after order creation', async () => {
    const { cart } = await seedCartWithItems()
    await redbird.orders.createFromCart(cart.id, { customerEmail: 'bob@example.com' })

    const refreshed = await redbird.cart.get(cart.id)
    expect(refreshed?.status).toBe('checked_out')
  })

  it('includes shipping and tax in totalAmount', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'charlie@example.com',
      shippingAmount: 590,
      taxAmount: 350,
    })

    expect(order.shippingAmount).toBe(590)
    expect(order.taxAmount).toBe(350)
    expect(order.totalAmount).toBe(order.subtotalAmount + 590 + 350)
  })

  it('full happy-path: pending → paid → fulfilled', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'dave@example.com',
    })

    const paid = await redbird.orders.markPaid(order.id)
    expect(paid.status).toBe('paid')

    const fulfilled = await redbird.orders.markFulfilled(order.id)
    expect(fulfilled.status).toBe('fulfilled')
  })

  it('cancels a pending order', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'eve@example.com',
    })

    const cancelled = await redbird.orders.cancel(order.id)
    expect(cancelled.status).toBe('cancelled')
  })

  it('refunds a paid order', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'frank@example.com',
    })
    await redbird.orders.markPaid(order.id)

    const refunded = await redbird.orders.refund(order.id)
    expect(refunded.status).toBe('refunded')
  })

  it('rejects invalid state machine transitions', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'grace@example.com',
    })

    // pending → fulfilled is not allowed
    await expect(redbird.orders.markFulfilled(order.id)).rejects.toThrow(
      /Cannot transition.*pending.*fulfilled/,
    )

    // pending → refunded is not allowed
    await expect(redbird.orders.refund(order.id)).rejects.toThrow(
      /Cannot transition.*pending.*refunded/,
    )
  })

  it('rejects checkout on an empty cart', async () => {
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await expect(
      redbird.orders.createFromCart(cart.id, { customerEmail: 'x@example.com' }),
    ).rejects.toThrow(/empty/)
  })

  it('rejects checkout on an already checked-out cart', async () => {
    const { cart } = await seedCartWithItems()
    await redbird.orders.createFromCart(cart.id, { customerEmail: 'y@example.com' })

    await expect(
      redbird.orders.createFromCart(cart.id, { customerEmail: 'y@example.com' }),
    ).rejects.toThrow(/not active/)
  })

  it('retrieves order by number', async () => {
    const { cart } = await seedCartWithItems()
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'zach@example.com',
    })

    const found = await redbird.orders.getByNumber(order.number)
    expect(found?.id).toBe(order.id)
  })

  it('lists orders filtered by status', async () => {
    const { cart: c1 } = await seedCartWithItems()
    const o1 = await redbird.orders.createFromCart(c1.id, { customerEmail: 'a@example.com' })
    await redbird.orders.markPaid(o1.id)

    // create a second product + cart for the second order
    await redbird.catalog.createProduct({ slug: 'mug', name: 'Redbird Mug', status: 'active' }, [
      { sku: 'MUG-1', name: 'Default', priceAmount: 1200, priceCurrency: 'EUR' },
    ])
    const p2 = await redbird.catalog.getProductBySlug('mug')
    const v = p2?.variants[0]!
    const c2 = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(c2.id, v.id, 1)
    await redbird.orders.createFromCart(c2.id, { customerEmail: 'b@example.com' })

    const pendingOrders = await redbird.orders.list({ status: 'pending' })
    const paidOrders = await redbird.orders.list({ status: 'paid' })

    expect(pendingOrders).toHaveLength(1)
    expect(paidOrders).toHaveLength(1)
    expect(paidOrders[0]?.id).toBe(o1.id)
  })
})
