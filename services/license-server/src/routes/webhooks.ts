import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type Stripe from 'stripe'
import { db } from '../db.js'
import { sendLicenseEmail } from '../email.js'
import { generateId, generateLicenseKey } from '../license-key.js'
import { createStripeClient } from '../stripe.js'
import { licenses } from '../schema.js'

export const webhooksRouter = new Hono()

webhooksRouter.post('/stripe', async (c) => {
  const stripe = createStripeClient()
  const sig = c.req.header('stripe-signature')
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET']

  if (!sig || !webhookSecret) return c.json({ error: 'Missing signature or secret' }, 400)

  let event: Stripe.Event
  try {
    const body = await c.req.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  const now = new Date().toISOString()

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    const email = customer.email ?? ''
    const status = sub.status as 'active' | 'cancelled' | 'past_due' | 'trialing'

    // Check if license already exists for this subscription
    const existing = await db.query.licenses.findFirst({
      where: eq(licenses.stripeSubscriptionId, sub.id),
    })

    if (existing) {
      await db.update(licenses)
        .set({ status, updatedAt: now })
        .where(eq(licenses.id, existing.id))
    } else {
      // New subscription → generate license key
      const newLicense = {
        id: generateId(),
        key: generateLicenseKey(false),
        email,
        plan: 'pro' as const,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await db.insert(licenses).values(newLicense)
      // Send license key by email (fire-and-forget, don't block webhook response)
      sendLicenseEmail({
        to: email,
        licenseKey: newLicense.key,
        plan: newLicense.plan,
      }).catch((err) => console.error('License email error:', err))
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await db.update(licenses)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(licenses.stripeSubscriptionId, sub.id))
  }

  return c.json({ ok: true })
})
