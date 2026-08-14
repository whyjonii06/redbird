import { and, eq, lte } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type Subscription, productVariants, subscriptions } from '../db/schema.js'
import type { EmailRegistry } from '../email/registry.js'

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
}

export type RunRemindersResult = {
  due: number
  reminded: number
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
  /**
   * Not real billing — see the schema comment on the `subscriptions` table.
   * Finds subscriptions due for renewal, advances nextRenewalAt so they aren't
   * reprocessed, and emails the customer a reminder with a link to reorder.
   * A send failure for one subscriber doesn't stop the rest.
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
}: {
  storeName: string
  productName: string
  quantity: number
  reorderUrl: string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Time to reorder</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin:0 0 8px">${storeName}</h2>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
  <h3 style="margin:0 0 12px">Time to reorder your subscription</h3>
  <p style="color:#6b7280;margin:0 0 24px">
    It's time to renew your subscription for ${quantity} × ${productName}. We don't auto-charge —
    click below to place your renewal order.
  </p>
  <a href="${reorderUrl}"
     style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
    Reorder now →
  </a>
</body>
</html>`
}

export function createSubscriptionService(db: DbClient, email: EmailRegistry): SubscriptionService {
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

  return {
    async create({ customerId, variantId, quantity = 1, interval }) {
      const [row] = await db
        .insert(subscriptions)
        .values({
          customerId,
          variantId,
          quantity,
          interval,
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

    async runReminders({ storeName = 'Store', storeUrl = '' } = {}) {
      const now = new Date()
      const due = await db.query.subscriptions.findMany({
        where: and(eq(subscriptions.status, 'active'), lte(subscriptions.nextRenewalAt, now)),
      })

      let reminded = 0
      let skipped = 0
      const provider = email.default()

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

        if (!provider) {
          skipped++
          continue
        }

        try {
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

          const reorderUrl = storeUrl ? `${storeUrl}/products/${variant.product.slug}` : '/'
          await provider.send({
            to: customer.email,
            subject: `Time to reorder ${variant.product.name} — ${storeName}`,
            html: reminderHtml({
              storeName,
              productName: variant.product.name,
              quantity: sub.quantity,
              reorderUrl,
            }),
            text: `Time to renew your subscription for ${sub.quantity} × ${variant.product.name}. Reorder: ${reorderUrl}`,
          })
          reminded++
        } catch {
          skipped++
        }
      }

      return { due: due.length, reminded, skipped }
    },
  }
}
