import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type Stripe from 'stripe'
import { db } from '../db.js'
import { sendLicenseEmail } from '../email.js'
import { generateId, generateLicenseKey } from '../license-key.js'
import { licenses } from '../schema.js'
import { createStripeClient } from '../stripe.js'

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

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer
    const email = customer.email ?? ''
    const status = sub.status as 'active' | 'cancelled' | 'past_due' | 'trialing'
    // Safety net: track the current billing period end. It's pushed forward on every
    // renewal webhook — if webhooks stop arriving entirely (retries exhausted, downtime),
    // the license naturally reads as expired instead of staying active forever.
    // current_period_end moved from the subscription root to each line item as of
    // API version 2026-05-27 (multi-item billing periods) — this account is on that
    // version, so sub.current_period_end is always undefined now. The installed
    // `stripe` SDK (17.7.0) predates this and still types SubscriptionItem without
    // the field, even though the real API response has it — cast around the stale type.
    const periodEnd = (sub.items.data[0] as unknown as { current_period_end?: number })
      ?.current_period_end
    if (periodEnd === undefined) {
      return c.json({ error: 'Subscription has no line items with a billing period' }, 400)
    }
    const expiresAt = new Date(periodEnd * 1000).toISOString()

    // Check if license already exists for this subscription
    const existing = await db.query.licenses.findFirst({
      where: eq(licenses.stripeSubscriptionId, sub.id),
    })

    if (existing) {
      await db
        .update(licenses)
        .set({ status, expiresAt, updatedAt: now })
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
        expiresAt,
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
    await db
      .update(licenses)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(licenses.stripeSubscriptionId, sub.id))
  }

  return c.json({ ok: true })
})
