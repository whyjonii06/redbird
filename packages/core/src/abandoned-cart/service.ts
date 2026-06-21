import { and, eq, isNotNull, lt } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { carts } from '../db/schema.js'
import type { EmailRegistry } from '../email/registry.js'

export type AbandonedCartResult = {
  processed: number
  emailed: number
  skipped: number
}

export type AbandonedCartService = {
  /**
   * Find carts that haven't been updated in `idleMinutes` (default 60),
   * mark them as abandoned, and send a recovery email if an email provider is available.
   */
  runRecovery(opts?: {
    idleMinutes?: number
    storeName?: string
    storeUrl?: string
  }): Promise<AbandonedCartResult>
}

export function createAbandonedCartService(
  db: DbClient,
  email: EmailRegistry,
): AbandonedCartService {
  return {
    async runRecovery({ idleMinutes = 60, storeName = 'Store', storeUrl = '' } = {}) {
      const cutoff = new Date(Date.now() - idleMinutes * 60 * 1000)

      // Find active carts with email that haven't been touched since cutoff
      const abandonedCarts = await db.query.carts.findMany({
        where: and(
          eq(carts.status, 'active'),
          isNotNull(carts.customerEmail),
          lt(carts.updatedAt, cutoff),
        ),
        with: { lineItems: true },
      })

      // Filter to carts that actually have items
      const withItems = abandonedCarts.filter((c) => c.lineItems.length > 0)

      let emailed = 0
      let skipped = 0

      const emailProvider = email.default()

      for (const cart of withItems) {
        // Mark as abandoned first to avoid re-processing
        await db
          .update(carts)
          .set({ status: 'abandoned', updatedAt: new Date() })
          .where(eq(carts.id, cart.id))

        if (!emailProvider || !cart.customerEmail) {
          skipped++
          continue
        }

        try {
          const cartUrl = storeUrl ? `${storeUrl}/cart` : '/cart'
          const itemCount = cart.lineItems.reduce((n, li) => n + li.quantity, 0)

          await emailProvider.send({
            to: cart.customerEmail,
            subject: `You left something behind — ${storeName}`,
            html: abandonedCartHtml({ storeName, cartUrl, itemCount }),
            text: `You left ${itemCount} item(s) in your cart at ${storeName}. Come back and complete your order: ${cartUrl}`,
          })
          emailed++
        } catch (err) {
          console.error(
            `[abandoned-cart] Failed to send recovery email to ${cart.customerEmail}:`,
            err,
          )
          skipped++
        }
      }

      return { processed: withItems.length, emailed, skipped }
    },
  }
}

function abandonedCartHtml({
  storeName,
  cartUrl,
  itemCount,
}: {
  storeName: string
  cartUrl: string
  itemCount: number
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You left something behind</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;color:#111">
  <h2 style="margin:0 0 8px">${storeName}</h2>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
  <h3 style="margin:0 0 12px">You left something behind!</h3>
  <p style="color:#6b7280;margin:0 0 24px">
    You have ${itemCount} item${itemCount !== 1 ? 's' : ''} waiting in your cart. Come back and complete your order before they run out.
  </p>
  <a href="${cartUrl}"
     style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
    Return to your cart →
  </a>
  <p style="margin:32px 0 0;font-size:12px;color:#9ca3af">
    If you no longer wish to receive these emails, simply ignore this message.
  </p>
</body>
</html>`
}
