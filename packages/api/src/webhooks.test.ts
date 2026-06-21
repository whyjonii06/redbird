import { createHmac } from 'node:crypto'
import { createRedbird } from '@redbirdshop/core'
import { paypal } from '@redbird/plugin-paypal'
import { stripe } from '@redbird/plugin-stripe'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './server.js'

const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_webhooks'

const stripePlugin = stripe({
  secretKey: 'sk_test_demo',
  webhookSecret: TEST_WEBHOOK_SECRET,
  dryRun: true,
})

const paypalPlugin = paypal({
  clientId: 'demo_client',
  clientSecret: 'demo_secret',
  webhookId: 'WH-TEST-ID',
  sandbox: true,
  dryRun: true,
})

const redbird = createRedbird({
  defaultCurrency: 'EUR',
  plugins: [stripePlugin, paypalPlugin],
})

const server = createApiServer({ redbird, port: 0 })
let port: number

async function postWebhook(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function stripeSignatureHeader(rawBody: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000)
  const payload = `${t}.${rawBody}`
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `t=${t},v1=${sig}`
}

async function seedOrder() {
  const product = await redbird.catalog.createProduct(
    { slug: `prod-${Date.now()}`, name: 'Test Product', status: 'active' },
    [{ sku: `SKU-${Date.now()}`, name: 'Default', priceAmount: 1000, priceCurrency: 'EUR' }],
  )
  const p = await redbird.catalog.getProductById(product.id)
  const variant = p?.variants[0]!
  const cart = await redbird.cart.create({ currency: 'EUR' })
  await redbird.cart.addItem(cart.id, variant.id, 1)
  return redbird.orders.createFromCart(cart.id, { customerEmail: 'test@example.com' })
}

describe('Webhook receiver', () => {
  beforeAll(async () => {
    await redbird.init()
    await server.listen()
    port = server.port
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await server.close()
    await redbird.close()
  })

  // ── Stripe ────────────────────────────────────────────────────────────────

  it('Stripe: marks order paid on payment_intent.succeeded', async () => {
    const order = await seedOrder()

    const event = {
      id: 'evt_test',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test', metadata: { orderId: order.id } } },
    }
    const rawBody = JSON.stringify(event)
    const sig = stripeSignatureHeader(rawBody, TEST_WEBHOOK_SECRET)

    const res = await postWebhook('/webhooks/stripe', event, { 'stripe-signature': sig })
    expect(res.status).toBe(200)

    const updated = await redbird.orders.get(order.id)
    expect(updated?.status).toBe('paid')
  })

  it('Stripe: returns 200 for non-payment events (no side effect)', async () => {
    const event = {
      id: 'evt_other',
      type: 'customer.created',
      data: { object: {} },
    }
    const rawBody = JSON.stringify(event)
    const sig = stripeSignatureHeader(rawBody, TEST_WEBHOOK_SECRET)

    const res = await postWebhook('/webhooks/stripe', event, { 'stripe-signature': sig })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { type: string }
    expect(body.type).toBe('customer.created')
  })

  it('Stripe: returns 400 on missing signature', async () => {
    const event = { type: 'payment_intent.succeeded', data: { object: {} } }
    const res = await postWebhook('/webhooks/stripe', event)
    expect(res.status).toBe(400)
  })

  it('Stripe: returns 400 on invalid signature', async () => {
    const event = { type: 'payment_intent.succeeded', data: { object: {} } }
    const res = await postWebhook('/webhooks/stripe', event, {
      'stripe-signature': 't=1,v1=badhash',
    })
    expect(res.status).toBe(400)
  })

  // ── PayPal ────────────────────────────────────────────────────────────────

  it('PayPal: marks order paid on CHECKOUT.ORDER.COMPLETED (dryRun)', async () => {
    const order = await seedOrder()

    const event = {
      event_type: 'CHECKOUT.ORDER.COMPLETED',
      resource: {
        id: 'PAYPAL_ORDER_123',
        purchase_units: [{ custom_id: order.id }],
      },
    }

    const res = await postWebhook('/webhooks/paypal', event)
    expect(res.status).toBe(200)

    const updated = await redbird.orders.get(order.id)
    expect(updated?.status).toBe('paid')
  })

  it('PayPal: marks order paid on PAYMENT.CAPTURE.COMPLETED (dryRun)', async () => {
    const order = await seedOrder()

    const event = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAPTURE_123', custom_id: order.id },
    }

    const res = await postWebhook('/webhooks/paypal', event)
    expect(res.status).toBe(200)

    const updated = await redbird.orders.get(order.id)
    expect(updated?.status).toBe('paid')
  })

  it('PayPal: returns 200 for unknown event types (no side effect)', async () => {
    const event = { event_type: 'BILLING.SUBSCRIPTION.CREATED', resource: {} }
    const res = await postWebhook('/webhooks/paypal', event)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { type: string }
    expect(body.type).toBe('BILLING.SUBSCRIPTION.CREATED')
  })

  // ── General ───────────────────────────────────────────────────────────────

  it('returns 404 for unknown webhook path', async () => {
    const res = await postWebhook('/webhooks/unknown', {})
    expect(res.status).toBe(404)
  })
})
