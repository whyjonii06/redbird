import { and, eq, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type Address,
  type Order,
  type OrderLineItem,
  carts,
  counters,
  orderLineItems,
  orders,
} from '../db/schema.js'
import type { PluginRegistry } from '../plugins/registry.js'
import type { StockService } from '../stock/service.js'

export type OrderWithItems = Order & { lineItems: OrderLineItem[] }

export type CreateOrderInput = {
  /** Required if not already set on the cart via cart.setEmail(). */
  customerEmail?: string | undefined
  shippingAddress?: Address | undefined
  shippingAmount?: number | undefined
  taxAmount?: number | undefined
  discountAmount?: number | undefined
  promoCode?: string | undefined
  notes?: string | undefined
}

export type OrderService = {
  createFromCart(cartId: string, input: CreateOrderInput): Promise<OrderWithItems>
  get(id: string): Promise<OrderWithItems | null>
  getByNumber(number: string): Promise<OrderWithItems | null>
  list(opts?: {
    status?: Order['status'] | undefined
    customerId?: string | undefined
    limit?: number | undefined
    offset?: number | undefined
  }): Promise<Order[]>
  count(opts?: { status?: Order['status'] | undefined }): Promise<number>
  /**
   * Assign (or return the already-assigned) sequential, gapless legal invoice
   * number for an order. Idempotent. Format: `YYYY-NNNNNN` per calendar year.
   */
  issueInvoice(orderId: string): Promise<{ number: string; issuedAt: Date }>
  /** List orders by customer email — for guest order tracking. */
  listByEmail(email: string, opts?: { limit?: number | undefined }): Promise<Order[]>
  markPaid(id: string): Promise<Order>
  markFulfilled(id: string): Promise<Order>
  cancel(id: string): Promise<Order>
  refund(id: string): Promise<Order>
  /** Issue a partial refund without changing order status. amount is in the order's currency minor units. */
  refundPartial(id: string, amount: number): Promise<Order>
  addNote(id: string, note: string): Promise<Order>
  setTracking(id: string, trackingNumber: string, trackingUrl?: string): Promise<Order>
}

const VALID_TRANSITIONS: Record<Order['status'], ReadonlyArray<Order['status']>> = {
  pending: ['paid', 'cancelled'],
  paid: ['fulfilled', 'cancelled', 'refunded'],
  fulfilled: ['refunded'],
  cancelled: [],
  refunded: [],
}

function generateOrderNumber(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase()
  return `ORD-${date}-${suffix}`
}

export function createOrderService(
  db: DbClient,
  hooks: PluginRegistry,
  stock?: StockService,
): OrderService {
  async function loadOrder(id: string): Promise<OrderWithItems | null> {
    const row = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { lineItems: true },
    })
    return row ?? null
  }

  async function loadOrderOrThrow(id: string): Promise<OrderWithItems> {
    const order = await loadOrder(id)
    if (!order) throw new Error(`Order ${id} not found`)
    return order
  }

  async function transition(
    id: string,
    to: Order['status'],
    hook: 'order.paid' | 'order.fulfilled' | 'order.cancelled' | 'order.refunded',
  ): Promise<Order> {
    const order = await loadOrderOrThrow(id)
    const allowed = VALID_TRANSITIONS[order.status]
    if (!allowed.includes(to)) {
      throw new Error(`Cannot transition order ${order.number} from "${order.status}" to "${to}"`)
    }
    const [updated] = await db
      .update(orders)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning()
    if (!updated) throw new Error('Failed to update order status')
    await hooks.emit(hook, { order: updated })
    return updated
  }

  return {
    async createFromCart(cartId, input) {
      const cart = await db.query.carts.findFirst({
        where: eq(carts.id, cartId),
        with: {
          lineItems: {
            with: {
              variant: {
                with: { product: true },
              },
            },
          },
        },
      })

      if (!cart) throw new Error(`Cart ${cartId} not found`)
      if (cart.status !== 'active')
        throw new Error(`Cart ${cartId} is not active (status: ${cart.status})`)
      if (cart.lineItems.length === 0) throw new Error(`Cart ${cartId} is empty`)
      const customerEmail = input.customerEmail ?? cart.customerEmail
      if (!customerEmail)
        throw new Error(
          'Customer email is required (pass it in input or call cart.setEmail() first)',
        )

      const shippingAmount = input.shippingAmount ?? 0
      // Tax: use the explicit amount if given, else derive it from per-product
      // VAT rates (taxRateBp) — supports multiple rates in one order.
      const taxAmount =
        input.taxAmount ??
        cart.lineItems.reduce((sum, li) => {
          const bp = li.variant?.product?.taxRateBp
          return bp == null ? sum : sum + Math.round((li.unitPriceAmount * li.quantity * bp) / 10000)
        }, 0)
      const discountAmount = input.discountAmount ?? 0
      const subtotalAmount = cart.lineItems.reduce(
        (sum, li) => sum + li.unitPriceAmount * li.quantity,
        0,
      )
      const totalAmount = Math.max(0, subtotalAmount + shippingAmount + taxAmount - discountAmount)

      const shippingAddress = input.shippingAddress ?? cart.shippingAddress ?? null

      const [order] = await db
        .insert(orders)
        .values({
          number: generateOrderNumber(),
          customerId: cart.customerId,
          customerEmail,
          currency: cart.currency,
          status: 'pending',
          subtotalAmount,
          shippingAmount,
          taxAmount,
          discountAmount,
          promoCode: input.promoCode ?? null,
          totalAmount,
          notes: input.notes ?? null,
          shippingAddress,
        })
        .returning()
      if (!order) throw new Error('Failed to create order')

      const lineItemValues = cart.lineItems.map((li) => {
        if (!li.variant) throw new Error(`Variant missing for cart line item ${li.id}`)
        if (!li.variant.product) throw new Error(`Product missing for variant ${li.variantId}`)
        return {
          orderId: order.id,
          variantId: li.variantId,
          productName: li.variant.product.name,
          variantName: li.variant.name,
          sku: li.variant.sku,
          quantity: li.quantity,
          unitPriceAmount: li.unitPriceAmount,
          unitPriceCurrency: li.unitPriceCurrency,
          totalAmount: li.unitPriceAmount * li.quantity,
          taxRateBp: li.variant.product.taxRateBp ?? null,
        }
      })

      const insertedLineItems = await db.insert(orderLineItems).values(lineItemValues).returning()

      await db
        .update(carts)
        .set({ status: 'checked_out', updatedAt: new Date() })
        .where(eq(carts.id, cartId))

      await hooks.emit('order.created', { order, lineItems: insertedLineItems })

      return { ...order, lineItems: insertedLineItems }
    },

    get: loadOrder,

    async getByNumber(number) {
      const row = await db.query.orders.findFirst({
        where: eq(orders.number, number),
        with: { lineItems: true },
      })
      return row ?? null
    },

    async list({ status, customerId, limit = 20, offset = 0 } = {}) {
      return db.query.orders.findMany({
        where: and(
          status !== undefined ? eq(orders.status, status) : undefined,
          customerId !== undefined ? eq(orders.customerId, customerId) : undefined,
        ),
        orderBy: (o, { desc }) => [desc(o.createdAt)],
        limit,
        offset,
      })
    },

    async count({ status } = {}) {
      return db.$count(orders, status !== undefined ? eq(orders.status, status) : undefined)
    },

    async issueInvoice(orderId) {
      return db.transaction(async (tx) => {
        const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) })
        if (!order) throw new Error(`Order ${orderId} not found`)
        if (order.invoiceNumber && order.invoicedAt) {
          return { number: order.invoiceNumber, issuedAt: order.invoicedAt }
        }
        // Atomic, gapless counter per calendar year. The counter row upsert
        // serialises concurrent issuance globally (Postgres row lock).
        const year = new Date().getUTCFullYear()
        const key = `invoice:${year}`
        const [counter] = await tx
          .insert(counters)
          .values({ key, value: 1 })
          .onConflictDoUpdate({ target: counters.key, set: { value: sql`${counters.value} + 1` } })
          .returning()
        const seq = counter?.value ?? 1
        const number = `${year}-${String(seq).padStart(6, '0')}`
        const issuedAt = new Date()
        await tx
          .update(orders)
          .set({ invoiceNumber: number, invoicedAt: issuedAt })
          .where(eq(orders.id, orderId))
        return { number, issuedAt }
      })
    },

    async listByEmail(email, { limit = 20 } = {}) {
      return db.query.orders.findMany({
        where: eq(orders.customerEmail, email),
        orderBy: (o, { desc }) => [desc(o.createdAt)],
        limit,
      })
    },

    async markPaid(id) {
      if (stock) {
        const order = await loadOrderOrThrow(id)
        for (const li of order.lineItems) {
          if (li.variantId) await stock.commit(li.variantId, li.quantity)
        }
      }
      return transition(id, 'paid', 'order.paid')
    },

    markFulfilled: (id) => transition(id, 'fulfilled', 'order.fulfilled'),

    async cancel(id) {
      if (stock) {
        const order = await loadOrderOrThrow(id)
        for (const li of order.lineItems) {
          if (!li.variantId) continue
          if (order.status === 'paid') {
            await stock.uncommit(li.variantId, li.quantity)
          } else {
            await stock.release(li.variantId, li.quantity)
          }
        }
      }
      return transition(id, 'cancelled', 'order.cancelled')
    },

    async refund(id) {
      if (stock) {
        const order = await loadOrderOrThrow(id)
        for (const li of order.lineItems) {
          if (li.variantId) await stock.uncommit(li.variantId, li.quantity)
        }
      }
      return transition(id, 'refunded', 'order.refunded')
    },

    async refundPartial(id, amount) {
      const order = await loadOrderOrThrow(id)
      if (order.status !== 'paid' && order.status !== 'fulfilled') {
        throw new Error(`Cannot refund order ${order.number} with status "${order.status}"`)
      }
      if (amount <= 0) throw new Error('Refund amount must be positive')
      const newRefunded = order.refundedAmount + amount
      if (newRefunded > order.totalAmount) {
        throw new Error(
          `Refund amount (${newRefunded}) exceeds order total (${order.totalAmount})`,
        )
      }
      const [updated] = await db
        .update(orders)
        .set({ refundedAmount: newRefunded, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()
      if (!updated) throw new Error(`Order ${id} not found`)
      return updated
    },

    async setTracking(id, trackingNumber, trackingUrl) {
      await loadOrderOrThrow(id)
      type TrackingPatch =
        | { trackingNumber: string; trackingUrl: string; updatedAt: Date }
        | { trackingNumber: string; updatedAt: Date }
      const patch: TrackingPatch =
        trackingUrl !== undefined
          ? { trackingNumber, trackingUrl, updatedAt: new Date() }
          : { trackingNumber, updatedAt: new Date() }
      const [updated] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning()
      if (!updated) throw new Error(`Order ${id} not found`)
      return updated
    },

    async addNote(id, note) {
      const order = await loadOrderOrThrow(id)
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
      const existing = order.notes ? `${order.notes}\n` : ''
      const [updated] = await db
        .update(orders)
        .set({ notes: `${existing}[${timestamp}] ${note}`, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()
      if (!updated) throw new Error(`Order ${id} not found`)
      return updated
    },
  }
}
