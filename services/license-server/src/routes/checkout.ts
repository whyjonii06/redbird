import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db.js'
import { licenses } from '../schema.js'
import { createStripeClient } from '../stripe.js'

export const checkoutRouter = new Hono()

// POST /v1/checkout/create-session
checkoutRouter.post('/create-session', async (c) => {
  const stripe = createStripeClient()
  const body = await c.req.json<{ email?: string; successUrl?: string; cancelUrl?: string }>()

  const priceId = process.env['STRIPE_PRICE_ID']
  if (!priceId) return c.json({ error: 'STRIPE_PRICE_ID not configured' }, 500)

  const baseUrl = process.env['MARKETPLACE_URL'] ?? 'http://localhost:5174'
  const successUrl = body.successUrl ?? `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = body.cancelUrl ?? `${baseUrl}/pricing`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(body.email ? { customer_email: body.email } : {}),
    metadata: { source: 'redbird-marketplace' },
  })

  return c.json({ url: session.url })
})

// GET /v1/checkout/session/:id — status + license key lookup
checkoutRouter.get('/session/:id', async (c) => {
  const stripe = createStripeClient()
  const session = await stripe.checkout.sessions.retrieve(c.req.param('id'), {
    expand: ['subscription'],
  })

  const email =
    session.customer_email ??
    session.customer_details?.email ??
    null

  let licenseKey: string | null = null

  const sub = session.subscription
  const subId = typeof sub === 'string' ? sub : sub?.id ?? null

  if (subId) {
    const license = await db.query.licenses.findFirst({
      where: eq(licenses.stripeSubscriptionId, subId),
    })
    licenseKey = license?.key ?? null
  }

  return c.json({
    status: session.status,
    email,
    licenseKey,
  })
})
