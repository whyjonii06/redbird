import { and, eq, inArray, ne } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type ReturnRequest,
  type ReturnRequestItem,
  orderLineItems,
  returnRequestItems,
  returnRequests,
} from '../db/schema.js'
import type { OrderService } from '../order/service.js'
import type { StockService } from '../stock/service.js'

export type CreateReturnItemInput = {
  lineItemId: string
  quantity: number
  /** Whether approving this item should add its quantity back to available stock. Default true. */
  restock?: boolean
}

export type CreateReturnInput = {
  orderId: string
  reason: string
  items: CreateReturnItemInput[]
}

export type ReturnRequestItemWithLineItem = ReturnRequestItem & {
  lineItem: { productName: string; variantName: string; sku: string } | null
}

export type ReturnRequestWithItems = ReturnRequest & { items: ReturnRequestItemWithLineItem[] }

export type ReturnService = {
  create(input: CreateReturnInput): Promise<ReturnRequestWithItems>
  list(opts?: {
    orderId?: string | undefined
    status?: ReturnRequest['status'] | undefined
  }): Promise<ReturnRequestWithItems[]>
  get(id: string): Promise<ReturnRequestWithItems | null>
  /**
   * Remaining returnable quantity per line item ID for an order — original
   * quantity minus whatever's already covered by a pending or approved
   * return, so a customer can't request the same units back twice.
   */
  returnableQuantities(orderId: string): Promise<Record<string, number>>
  /**
   * Approving a return now does the whole job: computes the refund from the
   * actual returned line items (not the whole order), issues it as a partial
   * refund, and restocks whichever items are flagged for it.
   */
  approve(id: string, adminNote?: string): Promise<ReturnRequestWithItems>
  reject(id: string, adminNote?: string): Promise<ReturnRequestWithItems>
}

export function createReturnService(
  db: DbClient,
  orders: OrderService,
  stock?: StockService,
): ReturnService {
  async function getWithItems(id: string): Promise<ReturnRequestWithItems | null> {
    const row = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, id),
      with: {
        items: {
          with: {
            lineItem: { columns: { productName: true, variantName: true, sku: true } },
          },
        },
      },
    })
    return row ?? null
  }

  async function returnableQuantities(orderId: string): Promise<Record<string, number>> {
    const lineItems = await db.query.orderLineItems.findMany({
      where: eq(orderLineItems.orderId, orderId),
    })
    if (lineItems.length === 0) return {}

    // Anything already covered by a pending or approved return is unavailable —
    // only a rejected return frees its quantity back up.
    const existing = await db.query.returnRequests.findMany({
      where: and(eq(returnRequests.orderId, orderId), ne(returnRequests.status, 'rejected')),
      with: { items: true },
    })
    const consumed = new Map<string, number>()
    for (const req of existing) {
      for (const item of req.items) {
        consumed.set(item.lineItemId, (consumed.get(item.lineItemId) ?? 0) + item.quantity)
      }
    }

    const result: Record<string, number> = {}
    for (const li of lineItems) {
      result[li.id] = li.quantity - (consumed.get(li.id) ?? 0)
    }
    return result
  }

  return {
    async create({ orderId, reason, items }) {
      if (items.length === 0) throw new Error('At least one item is required')

      const remaining = await returnableQuantities(orderId)
      for (const item of items) {
        const available = remaining[item.lineItemId]
        if (available === undefined) {
          throw new Error(`Line item ${item.lineItemId} does not belong to order ${orderId}`)
        }
        if (item.quantity < 1) throw new Error('Quantity must be at least 1')
        if (item.quantity > available) {
          throw new Error(`Only ${available} unit(s) of this item can still be returned`)
        }
      }

      return db.transaction(async (tx) => {
        const [req] = await tx.insert(returnRequests).values({ orderId, reason }).returning()
        if (!req) throw new Error('Failed to create return request')
        const inserted = await tx
          .insert(returnRequestItems)
          .values(
            items.map((item) => ({
              returnRequestId: req.id,
              lineItemId: item.lineItemId,
              quantity: item.quantity,
              restock: item.restock ?? true,
            })),
          )
          .returning()
        const lineItemRows = await tx.query.orderLineItems.findMany({
          where: inArray(
            orderLineItems.id,
            inserted.map((item) => item.lineItemId),
          ),
          columns: { id: true, productName: true, variantName: true, sku: true },
        })
        const lineItemById = new Map(lineItemRows.map((li) => [li.id, li]))
        return {
          ...req,
          items: inserted.map((item) => ({
            ...item,
            lineItem: lineItemById.get(item.lineItemId) ?? null,
          })),
        }
      })
    },

    async list({ orderId, status } = {}) {
      const rows = await db.query.returnRequests.findMany({
        where:
          orderId && status
            ? and(eq(returnRequests.orderId, orderId), eq(returnRequests.status, status))
            : orderId
              ? eq(returnRequests.orderId, orderId)
              : status
                ? eq(returnRequests.status, status)
                : undefined,
        orderBy: (r, { desc }) => [desc(r.createdAt)],
        with: {
          items: {
            with: {
              lineItem: { columns: { productName: true, variantName: true, sku: true } },
            },
          },
        },
      })
      return rows
    },

    get: getWithItems,

    returnableQuantities,

    async approve(id, adminNote) {
      const existing = await getWithItems(id)
      if (!existing) throw new Error(`Return request ${id} not found`)
      if (existing.status !== 'pending') {
        throw new Error(`Return request ${id} was already ${existing.status}`)
      }

      const [req] = await db
        .update(returnRequests)
        .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: new Date() })
        .where(eq(returnRequests.id, id))
        .returning()
      if (!req) throw new Error(`Return request ${id} not found`)

      const lineItemIds = existing.items.map((item) => item.lineItemId)
      const lineItems =
        lineItemIds.length > 0
          ? await db.query.orderLineItems.findMany({
              where: inArray(orderLineItems.id, lineItemIds),
            })
          : []
      const lineItemById = new Map(lineItems.map((li) => [li.id, li]))

      let refundAmount = 0
      for (const item of existing.items) {
        const li = lineItemById.get(item.lineItemId)
        if (li) refundAmount += li.unitPriceAmount * item.quantity
      }
      if (refundAmount > 0) await orders.refundPartial(existing.orderId, refundAmount)

      if (stock) {
        for (const item of existing.items) {
          if (!item.restock) continue
          const li = lineItemById.get(item.lineItemId)
          if (li?.variantId) await stock.adjust(li.variantId, item.quantity)
        }
      }

      return { ...req, items: existing.items }
    },

    async reject(id, adminNote) {
      const existing = await getWithItems(id)
      if (!existing) throw new Error(`Return request ${id} not found`)
      const [req] = await db
        .update(returnRequests)
        .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
        .where(eq(returnRequests.id, id))
        .returning()
      if (!req) throw new Error(`Return request ${id} not found`)
      return { ...req, items: existing.items }
    },
  }
}
