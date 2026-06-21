import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Invoice numbering (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })
  const year = new Date().getUTCFullYear()

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products, counters RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  async function makeOrder(i: number) {
    await redbird.catalog.createProduct({ slug: `prod-${i}`, name: `Product ${i}`, status: 'active' }, [
      { sku: `SKU-${i}`, name: 'default', priceAmount: 1000, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug(`prod-${i}`)
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, p!.variants[0]!.id, 1)
    return redbird.orders.createFromCart(cart.id, { customerEmail: 'buyer@example.com' })
  }

  it('assigns sequential, gapless numbers per year', async () => {
    const o1 = await makeOrder(1)
    const o2 = await makeOrder(2)
    const i1 = await redbird.orders.issueInvoice(o1.id)
    const i2 = await redbird.orders.issueInvoice(o2.id)
    expect(i1.number).toBe(`${year}-000001`)
    expect(i2.number).toBe(`${year}-000002`)
  })

  it('is idempotent — re-issuing returns the same number and draws no new value', async () => {
    const o1 = await makeOrder(1)
    const first = await redbird.orders.issueInvoice(o1.id)
    const again = await redbird.orders.issueInvoice(o1.id)
    expect(again.number).toBe(first.number)

    // The next order still gets ...000002 (no value was wasted on the re-issue).
    const o2 = await makeOrder(2)
    const third = await redbird.orders.issueInvoice(o2.id)
    expect(third.number).toBe(`${year}-000002`)
  })

  it('persists the invoice number on the order', async () => {
    const o1 = await makeOrder(1)
    const { number } = await redbird.orders.issueInvoice(o1.id)
    const reloaded = await redbird.orders.get(o1.id)
    expect(reloaded?.invoiceNumber).toBe(number)
    expect(reloaded?.invoicedAt).toBeInstanceOf(Date)
  })
})
