import { createRedbird } from '@redbirdshop/core'
import { resend } from '@redbird/plugin-email-resend'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Email transactional (integration)', () => {
  const emailPlugin = resend({
    apiKey: 're_test_key',
    from: 'shop@example.com',
    storeName: 'Test Shop',
    dryRun: true,
  })

  const redbird = createRedbird({
    defaultCurrency: 'EUR',
    plugins: [emailPlugin],
  })

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

  async function createTestOrder() {
    await redbird.catalog.createProduct({ slug: 'espresso', name: 'Espresso', status: 'active' }, [
      { sku: 'ESP-1', name: '250g', priceAmount: 1200, priceCurrency: 'EUR' },
    ])
    const product = await redbird.catalog.getProductBySlug('espresso')
    if (!product) throw new Error('product not found')
    const variant = product.variants[0]
    if (!variant) throw new Error('variant not found')
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variant.id, 1)
    return redbird.orders.createFromCart(cart.id, { customerEmail: 'customer@example.com' })
  }

  it('email provider is registered on redbird.email', () => {
    expect(redbird.email.default()?.name).toBe('@redbird/plugin-email-resend')
  })

  it('sends order confirmation email on order.created', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await createTestOrder()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[resend:dryRun] to=customer@example.com'),
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('sends payment email on order.paid', async () => {
    const order = await createTestOrder()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await redbird.orders.markPaid(order.id)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[resend:dryRun] to=customer@example.com'),
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('sends fulfilment email on order.fulfilled', async () => {
    const order = await createTestOrder()
    await redbird.orders.markPaid(order.id)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await redbird.orders.markFulfilled(order.id)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[resend:dryRun] to=customer@example.com'),
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('sends cancellation email on order.cancelled', async () => {
    const order = await createTestOrder()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await redbird.orders.cancel(order.id)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[resend:dryRun] to=customer@example.com'),
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('email.send() uses the default provider', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await redbird.email.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hello</p>',
        text: 'Hello',
      })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[resend:dryRun] to=test@example.com'),
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })
})
