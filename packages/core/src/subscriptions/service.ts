import { and, eq, lte } from 'drizzle-orm'
import type { CartService } from '../cart/service.js'
import type { DbClient } from '../db/client.js'
import {
  type Subscription,
  customerPaymentMethods,
  productVariants,
  subscriptions,
} from '../db/schema.js'
import type { EmailRegistry } from '../email/registry.js'
import type { OrderService } from '../order/service.js'
import type { PaymentRegistry } from '../payments/registry.js'

export type SubscriptionInterval = Subscription['interval']

export type SubscriptionWithProduct = Subscription & {
  productName: string
  variantName: string
  sku: string
  priceAmount: number
  priceCurrency: string
}

export type CreateSubscriptionInput = {
  customerId: string
  variantId: string
  quantity?: number
  interval: SubscriptionInterval
  /** Saved payment method to auto-charge on renewal. Omit for reminder-email-only. */
  paymentMethodId?: string | undefined
}

export type RunRemindersResult = {
  due: number
  /** Successfully auto-charged and turned into a paid order. */
  charged: number
  /** No saved payment method (or provider doesn't support off-session) — reminder email sent instead. */
  reminded: number
  /** A saved payment method exists but the off-session charge was declined or errored. */
  failed: number
  /** Charge/reminder both unavailable (no email provider, missing customer/product, etc). */
  skipped: number
}

export type SubscriptionService = {
  create(input: CreateSubscriptionInput): Promise<Subscription>
  list(customerId: string): Promise<SubscriptionWithProduct[]>
  listAll(): Promise<SubscriptionWithProduct[]>
  get(id: string): Promise<SubscriptionWithProduct | null>
  pause(id: string): Promise<Subscription>
  resume(id: string): Promise<Subscription>
  cancel(id: string): Promise<Subscription>
  setPaymentMethod(id: string, paymentMethodId: string | null): Promise<Subscription>
  /**
   * Finds subscriptions due for renewal. When one has a saved payment method
   * attached, charges it off-session and turns the charge into a paid order
   * — no customer interaction needed. Falls back to a reminder email with a
   * reorder link when there's no saved method, the provider can't charge
   * off-session, or the charge is declined. A failure for one subscriber
   * never stops the rest.
   */
  runReminders(opts?: {
    storeName?: string | undefined
    storeUrl?: string | undefined
  }): Promise<RunRemindersResult>
}

export function nextRenewalDate(from: Date, interval: SubscriptionInterval): Date {
  const d = new Date(from)
  if (interval === 'weekly') d.setDate(d.getDate() + 7)
  else if (interval === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d
}

function reminderHtml({
  storeName,
  productName,
  quantity,
  reorderUrl,
  chargeFailed,
}: {
  storeName: string
  productName: string
  quantity: number
  reorderUrl: string
  chargeFailed: boolean
}): string {
  const body = chargeFailed
    ? `We tried to charge your saved card for your ${quantity} × ${productName} renewal, but the
       charge didn't go through. Update your payment method or reorder manually below.`
    : `It's time to renew your subscription for ${quantity} × ${productName}. Click below to place
       your renewal order.`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Time to reorder</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin:0 0 8px">${storeName}</h2>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
  <h3 style="margin:0 0 12px">${chargeFailed ? 'Your renewal charge failed' : 'Time to reorder your subscription'}</h3>
  <p style="color:#6b7280;margin:0 0 24px">${body}</p>
  <a href="${reorderUrl}"
     style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
    Reorder now →
  </a>
</body>
</html>`
}

function renewedHtml({
  storeName,
  productName,
  quantity,
  orderNumber,
}: {
  storeName: string
  productName: string
  quantity: number
  orderNumber: string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Subscription renewed</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin:0 0 8px">${storeName}</h2>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
  <h3 style="margin:0 0 12px">Your subscription renewed</h3>
  <p style="color:#6b7280;margin:0 0 8px">
    We've charged your saved card for ${quantity} × ${productName} and placed order #${orderNumber}.
  </p>
</body>
</html>`
}

export function createSubscriptionService(
  db: DbClient,
  email: EmailRegistry,
  cart: CartService,
  orders: OrderService,
  payments: PaymentRegistry,
): SubscriptionService {
  async function withProduct(row: Subscription): Promise<SubscriptionWithProduct> {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, row.variantId),
      with: { product: true },
    })
    return {
      ...row,
      productName: variant?.product?.name ?? 'Unknown product',
      variantName: variant?.name ?? '',
      sku: variant?.sku ?? '',
      priceAmount: variant?.priceAmount ?? 0,
      priceCurrency: variant?.priceCurrency ?? 'EUR',
    }
  }

  /** Attempts an off-session renewal charge. Returns the paid order number on success, null otherwise. */
  async function tryCharge(
    sub: Subscription,
    variant: { priceAmount: number; priceCurrency: string; product: { name: string } | null },
    customerEmail: string,
  ): Promise<string | null> {
    if (!sub.paymentMethodId) return null
    const pm = await db.query.customerPaymentMethods.findFirst({
      where: eq(customerPaymentMethods.id, sub.paymentMethodId),
    })
    if (!pm) return null
    const provider = payments.get(pm.provider)
    if (!provider?.chargeOffSession) return null

    const amount = variant.priceAmount * sub.quantity
    const intent = await provider.chargeOffSession({
      customerRef: pm.providerCustomerId,
      paymentMethodRef: pm.providerPaymentMethodId,
      amount,
      currency: variant.priceCurrency,
      metadata: { subscriptionId: sub.id },
    })
    if (intent.status !== 'succeeded') return null

    const newCart = await cart.create({
      currency: variant.priceCurrency,
      customerId: sub.customerId,
    })
    await cart.addItem(newCart.id, sub.variantId, sub.quantity)
    const order = await orders.createFromCart(newCart.id, { customerEmail })
    await orders.setPaymentReference(order.id, provider.name, intent.id)
    await orders.markPaid(order.id)
    return order.number
  }

  return {
    async create({ customerId, variantId, quantity = 1, interval, paymentMethodId }) {
      const [row] = await db
        .insert(subscriptions)
        .values({
          customerId,
          variantId,
          quantity,
          interval,
          paymentMethodId: paymentMethodId ?? null,
          nextRenewalAt: nextRenewalDate(new Date(), interval),
        })
        .returning()
      if (!row) throw new Error('Failed to create subscription')
      return row
    },

    async list(customerId) {
      const rows = await db.query.subscriptions.findMany({
        where: eq(subscriptions.customerId, customerId),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
      return Promise.all(rows.map(withProduct))
    },

    async listAll() {
      const rows = await db.query.subscriptions.findMany({
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
      return Promise.all(rows.map(withProduct))
    },

    async get(id) {
      const row = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) })
      return row ? withProduct(row) : null
    },

    async pause(id) {
      const [row] = await db
        .update(subscriptions)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(eq(subscriptions.id, id))
        .returning()
      if (!row) throw new Error(`Subscription ${id} not found`)
      return row
    },

    async resume(id) {
      const existing = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, id) })
      if (!existing) throw new Error(`Subscription ${id} not found`)
      const [row] = await db
        .update(subscriptions)
        .set({
          status: 'active',
          // Resuming shouldn't re-fire a reminder for a date that's already passed.
          nextRenewalAt:
            existing.nextRenewalAt < new Date()
              ? nextRenewalDate(new Date(), existing.interval)
              : existing.nextRenewalAt,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, id))
        .returning()
      if (!row) throw new Error(`Subscription ${id} not found`)
      return row
    },

    async cancel(id) {
      const [row] = await db
        .update(subscriptions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(subscriptions.id, id))
        .returning()
      if (!row) throw new Error(`Subscription ${id} not found`)
      return row
    },

    async setPaymentMethod(id, paymentMethodId) {
      const [row] = await db
        .update(subscriptions)
        .set({ paymentMethodId, updatedAt: new Date() })
        .where(eq(subscriptions.id, id))
        .returning()
      if (!row) throw new Error(`Subscription ${id} not found`)
      return row
    },

    async runReminders({ storeName = 'Store', storeUrl = '' } = {}) {
      const now = new Date()
      const due = await db.query.subscriptions.findMany({
        where: and(eq(subscriptions.status, 'active'), lte(subscriptions.nextRenewalAt, now)),
      })

      let charged = 0
      let reminded = 0
      let failed = 0
      let skipped = 0
      const emailProvider = email.default()

      for (const sub of due) {
        // Advance first so a crash or send failure doesn't reprocess the same
        // cycle forever — mirrors the abandoned-cart recovery pattern.
        await db
          .update(subscriptions)
          .set({
            nextRenewalAt: nextRenewalDate(sub.nextRenewalAt, sub.interval),
            lastReminderSentAt: now,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id))

        const [customer, variant] = await Promise.all([
          db.query.customers.findFirst({
            where: (c, { eq: eqFn }) => eqFn(c.id, sub.customerId),
          }),
          db.query.productVariants.findFirst({
            where: eq(productVariants.id, sub.variantId),
            with: { product: true },
          }),
        ])
        if (!customer || !variant?.product) {
          skipped++
          continue
        }

        let orderNumber: string | null = null
        let chargeAttempted = false
        if (sub.paymentMethodId) {
          chargeAttempted = true
          try {
            orderNumber = await tryCharge(sub, variant, customer.email)
          } catch (err) {
            console.error('[DEBUG tryCharge]', err)
            orderNumber = null
          }
        }

        if (orderNumber) {
          charged++
          if (emailProvider) {
            try {
              await emailProvider.send({
                to: customer.email,
                subject: `Your subscription renewed — ${storeName}`,
                html: renewedHtml({
                  storeName,
                  productName: variant.product.name,
                  quantity: sub.quantity,
                  orderNumber,
                }),
                text: `Renewed: ${sub.quantity} × ${variant.product.name}, order #${orderNumber}.`,
              })
            } catch {
              // Charge already succeeded — a confirmation email failure isn't worth counting as a failure.
            }
          }
          continue
        }

        if (chargeAttempted) failed++

        if (!emailProvider) {
          skipped++
          continue
        }

        try {
          const reorderUrl = storeUrl ? `${storeUrl}/products/${variant.product.slug}` : '/'
          await emailProvider.send({
            to: customer.email,
            subject: chargeAttempted
              ? `Action needed: your renewal charge failed — ${storeName}`
              : `Time to reorder ${variant.product.name} — ${storeName}`,
            html: reminderHtml({
              storeName,
              productName: variant.product.name,
              quantity: sub.quantity,
              reorderUrl,
              chargeFailed: chargeAttempted,
            }),
            text: `${chargeAttempted ? 'Renewal charge failed for' : 'Time to renew'} ${sub.quantity} × ${variant.product.name}. Reorder: ${reorderUrl}`,
          })
          reminded++
        } catch {
          skipped++
        }
      }

      return { due: due.length, charged, reminded, failed, skipped }
    },
  }
}
