import { and, eq } from 'drizzle-orm'
import type { CartService } from '../cart/service.js'
import type { DbClient } from '../db/client.js'
import {
  type QuoteRequest,
  type QuoteRequestItem,
  cartLineItems,
  quoteRequestItems,
  quoteRequests,
} from '../db/schema.js'

export type QuoteStatus = QuoteRequest['status']

export type CreateQuoteItemInput = {
  variantId: string
  quantity: number
}

export type CreateQuoteInput = {
  customerId: string
  currency: string
  items: CreateQuoteItemInput[]
  customerNote?: string | undefined
}

export type QuoteRequestItemWithVariant = QuoteRequestItem & {
  variant: { productName: string; variantName: string; sku: string; priceAmount: number } | null
}

export type QuoteRequestWithItems = QuoteRequest & { items: QuoteRequestItemWithVariant[] }

export type RespondItemInput = {
  itemId: string
  quotedPriceAmount: number
}

export type QuoteService = {
  create(input: CreateQuoteInput): Promise<QuoteRequestWithItems>
  list(opts?: {
    customerId?: string | undefined
    status?: QuoteStatus | undefined
  }): Promise<QuoteRequestWithItems[]>
  get(id: string): Promise<QuoteRequestWithItems | null>
  /** Staff sets a negotiated unit price per item and moves the request to "quoted". */
  respond(
    id: string,
    items: RespondItemInput[],
    opts?: { staffNote?: string; expiresAt?: Date },
  ): Promise<QuoteRequestWithItems>
  reject(id: string, staffNote?: string): Promise<QuoteRequestWithItems>
  /**
   * Customer accepts a quoted request — builds a cart at exactly the quoted
   * prices (bypassing normal live pricing, since the whole point of a quote
   * is a one-off negotiated price) and returns its id for checkout.
   */
  accept(id: string, customerId: string): Promise<{ cartId: string }>
}

export function createQuoteService(db: DbClient, cart: CartService): QuoteService {
  async function getWithItems(id: string): Promise<QuoteRequestWithItems | null> {
    const row = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
      with: {
        items: {
          with: {
            variant: {
              columns: { name: true, sku: true, priceAmount: true },
              with: { product: { columns: { name: true } } },
            },
          },
        },
      },
    })
    if (!row) return null
    return {
      ...row,
      items: row.items.map((item) => ({
        ...item,
        variant: item.variant
          ? {
              productName: item.variant.product?.name ?? 'Unknown product',
              variantName: item.variant.name,
              sku: item.variant.sku,
              priceAmount: item.variant.priceAmount,
            }
          : null,
      })),
    }
  }

  return {
    async create({ customerId, currency, items, customerNote }) {
      if (items.length === 0) throw new Error('At least one item is required')
      const created = await db.transaction(async (tx) => {
        const [req] = await tx
          .insert(quoteRequests)
          .values({ customerId, currency, customerNote: customerNote ?? null })
          .returning()
        if (!req) throw new Error('Failed to create quote request')
        await tx.insert(quoteRequestItems).values(
          items.map((item) => ({
            quoteRequestId: req.id,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        )
        return req
      })
      const withItems = await getWithItems(created.id)
      if (!withItems) throw new Error('Failed to load created quote request')
      return withItems
    },

    async list({ customerId, status } = {}) {
      const rows = await db.query.quoteRequests.findMany({
        where:
          customerId && status
            ? and(eq(quoteRequests.customerId, customerId), eq(quoteRequests.status, status))
            : customerId
              ? eq(quoteRequests.customerId, customerId)
              : status
                ? eq(quoteRequests.status, status)
                : undefined,
        orderBy: (q, { desc }) => [desc(q.createdAt)],
        with: {
          items: {
            with: {
              variant: {
                columns: { name: true, sku: true, priceAmount: true },
                with: { product: { columns: { name: true } } },
              },
            },
          },
        },
      })
      return rows.map((row) => ({
        ...row,
        items: row.items.map((item) => ({
          ...item,
          variant: item.variant
            ? {
                productName: item.variant.product?.name ?? 'Unknown product',
                variantName: item.variant.name,
                sku: item.variant.sku,
                priceAmount: item.variant.priceAmount,
              }
            : null,
        })),
      }))
    },

    get: getWithItems,

    async respond(id, items, opts) {
      const existing = await getWithItems(id)
      if (!existing) throw new Error(`Quote request ${id} not found`)
      if (existing.status !== 'pending') {
        throw new Error(`Quote request ${id} is not pending (status: ${existing.status})`)
      }
      const itemIds = new Set(existing.items.map((i) => i.id))
      for (const item of items) {
        if (!itemIds.has(item.itemId)) {
          throw new Error(`Item ${item.itemId} does not belong to quote request ${id}`)
        }
        if (item.quotedPriceAmount < 0) throw new Error('Quoted price must be non-negative')
      }

      await db.transaction(async (tx) => {
        for (const item of items) {
          await tx
            .update(quoteRequestItems)
            .set({ quotedPriceAmount: item.quotedPriceAmount })
            .where(eq(quoteRequestItems.id, item.itemId))
        }
        await tx
          .update(quoteRequests)
          .set({
            status: 'quoted',
            staffNote: opts?.staffNote ?? existing.staffNote,
            expiresAt: opts?.expiresAt ?? existing.expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(quoteRequests.id, id))
      })

      const updated = await getWithItems(id)
      if (!updated) throw new Error(`Quote request ${id} not found after update`)
      return updated
    },

    async reject(id, staffNote) {
      const [req] = await db
        .update(quoteRequests)
        .set({ status: 'rejected', staffNote: staffNote ?? null, updatedAt: new Date() })
        .where(eq(quoteRequests.id, id))
        .returning()
      if (!req) throw new Error(`Quote request ${id} not found`)
      const withItems = await getWithItems(id)
      if (!withItems) throw new Error(`Quote request ${id} not found after update`)
      return withItems
    },

    async accept(id, customerId) {
      const existing = await getWithItems(id)
      if (!existing) throw new Error(`Quote request ${id} not found`)
      if (existing.customerId !== customerId) {
        throw new Error(`Quote request ${id} does not belong to this customer`)
      }
      if (existing.status !== 'quoted') {
        throw new Error(`Quote request ${id} is not ready to accept (status: ${existing.status})`)
      }
      if (existing.expiresAt && existing.expiresAt < new Date()) {
        await db
          .update(quoteRequests)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(quoteRequests.id, id))
        throw new Error('This quote has expired')
      }

      const newCart = await cart.create({ currency: existing.currency, customerId })
      await db.transaction(async (tx) => {
        for (const item of existing.items) {
          if (item.quotedPriceAmount == null) continue
          await tx.insert(cartLineItems).values({
            cartId: newCart.id,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPriceAmount: item.quotedPriceAmount,
            unitPriceCurrency: existing.currency,
          })
        }
        await tx
          .update(quoteRequests)
          .set({ status: 'accepted', updatedAt: new Date() })
          .where(eq(quoteRequests.id, id))
      })

      return { cartId: newCart.id }
    },
  }
}
