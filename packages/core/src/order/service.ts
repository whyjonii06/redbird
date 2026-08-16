import { and, eq, sql } from 'drizzle-orm'
import type { CartService } from '../cart/service.js'
import type { DbClient } from '../db/client.js'
import {
  type Address,
  type Order,
  type OrderLineItem,
  carts,
  counters,
  customerPaymentMethods,
  orderLineItems,
  orders,
} from '../db/schema.js'
import type { PaymentRegistry } from '../payments/registry.js'
import type { PluginRegistry } from '../plugins/registry.js'
import type { StockService } from '../stock/service.js'

/** Postgres/PGlite unique_violation error code. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION
  )
}

export type OrderWithItems = Order & { lineItems: OrderLineItem[] }

export type ReorderResult = {
  /** Present when a saved payment method covered the charge — the new paid order. */
  order: OrderWithItems | null
  /** Present when there's no usable saved payment method (or the charge failed) — hand this cart to normal checkout instead. */
  cartId: string | null
  /** Line items from the original order that couldn't be re-added — removed product, out of stock, etc. */
  skippedLineItems: Array<{ productName: string; reason: string }>
}

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
  /** Record which provider + reference (PaymentIntent id, PayPal order id...) paid this order. */
  setPaymentReference(id: string, provider: string, reference: string): Promise<Order>
  markPaid(id: string): Promise<Order>
  markFulfilled(id: string): Promise<Order>
  cancel(id: string): Promise<Order>
  refund(id: string): Promise<Order>
  /** Issue a partial refund without changing order status. amount is in the order's currency minor units. */
  refundPartial(id: string, amount: number): Promise<Order>
  addNote(id: string, note: string): Promise<Order>
  setTracking(id: string, trackingNumber: string, trackingUrl?: string): Promise<Order>
  /**
   * Rebuilds a cart from a past order's line items at current prices/stock,
   * skipping anything no longer available. If the customer has a default
   * saved payment method that supports off-session charging, charges it
   * immediately and returns the resulting paid order; otherwise returns the
   * built cart id for the caller to hand off to normal checkout.
   */
  reorder(orderId: string, customerId: string): Promise<ReorderResult>
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
  // 6 hex chars (~16.7M combinations/day) plus the retry-on-conflict loop below make a
  // collision on the `orders_number_idx` unique index effectively impossible in practice.
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase()
  return `ORD-${date}-${suffix}`
}

export function createOrderService(
  db: DbClient,
  hooks: PluginRegistry,
  stock?: StockService,
  payments?: PaymentRegistry,
  cart?: CartService,
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

  const service: OrderService = {
    async createFromCart(cartId, input) {
      const MAX_ATTEMPTS = 5
      let result: OrderWithItems | undefined
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          result = await db.transaction(async (tx) => {
            const cart = await tx.query.carts.findFirst({
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
            const discountAmount = input.discountAmount ?? 0
            const subtotalAmount = cart.lineItems.reduce(
              (sum, li) => sum + li.unitPriceAmount * li.quantity,
              0,
            )
            // Tax: use the explicit amount if given (computed by the caller on the
            // post-discount subtotal), else derive it from per-product VAT rates
            // (taxRateBp), prorating the discount across line items so tax is never
            // charged on the discounted-away portion.
            const discountRatio =
              subtotalAmount > 0 ? Math.min(1, discountAmount / subtotalAmount) : 0
            const taxAmount =
              input.taxAmount ??
              cart.lineItems.reduce((sum, li) => {
                const bp = li.variant?.product?.taxRateBp
                if (bp == null) return sum
                const lineNet = li.unitPriceAmount * li.quantity * (1 - discountRatio)
                return sum + Math.round((lineNet * bp) / 10000)
              }, 0)
            const totalAmount = Math.max(
              0,
              subtotalAmount + shippingAmount + taxAmount - discountAmount,
            )

            const shippingAddress = input.shippingAddress ?? cart.shippingAddress ?? null

            const [order] = await tx
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
                tenantId: cart.tenantId,
              })
              .returning()
            if (!order) throw new Error('Failed to create order')

            const lineItemValues = cart.lineItems.map((li) => {
              if (!li.variant) throw new Error(`Variant missing for cart line item ${li.id}`)
              if (!li.variant.product)
                throw new Error(`Product missing for variant ${li.variantId}`)
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
                sellerId: li.variant.product.sellerId ?? null,
              }
            })

            const insertedLineItems = await tx
              .insert(orderLineItems)
              .values(lineItemValues)
              .returning()

            await tx
              .update(carts)
              .set({ status: 'checked_out', updatedAt: new Date() })
              .where(eq(carts.id, cartId))

            return { ...order, lineItems: insertedLineItems }
          })
          break
        } catch (err) {
          if (isUniqueViolation(err) && attempt < MAX_ATTEMPTS) continue
          throw err
        }
      }
      if (!result) throw new Error('Failed to create order after multiple attempts')

      // Side-effecting hooks (payment intent creation, emails...) run after the order
      // is durably committed, so a hook failure never rolls back a placed order.
      const { lineItems, ...order } = result
      await hooks.emit('order.created', { order, lineItems })

      return result
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

    async setPaymentReference(id, provider, reference) {
      const [updated] = await db
        .update(orders)
        .set({ paymentProvider: provider, paymentReference: reference, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()
      if (!updated) throw new Error(`Order ${id} not found`)
      return updated
    },

    async markPaid(id) {
      // Load line items before the transition so a stock mutation never runs after a
      // transition that turns out to be invalid (transition() re-validates from a fresh read).
      const before = stock ? await loadOrderOrThrow(id) : null
      const updated = await transition(id, 'paid', 'order.paid')
      if (stock && before) {
        for (const li of before.lineItems) {
          if (li.variantId) await stock.commit(li.variantId, li.quantity)
        }
      }
      return updated
    },

    markFulfilled: (id) => transition(id, 'fulfilled', 'order.fulfilled'),

    async cancel(id) {
      const before = stock ? await loadOrderOrThrow(id) : null
      const updated = await transition(id, 'cancelled', 'order.cancelled')
      if (stock && before) {
        for (const li of before.lineItems) {
          if (!li.variantId) continue
          if (before.status === 'paid') {
            await stock.uncommit(li.variantId, li.quantity)
          } else {
            await stock.release(li.variantId, li.quantity)
          }
        }
      }
      return updated
    },

    async refund(id) {
      const before = await loadOrderOrThrow(id)
      // Validate the transition before touching the payment gateway — transition()
      // re-validates from a fresh read regardless, this just avoids refunding money at
      // the gateway for a transition that's already known to be illegal.
      if (!VALID_TRANSITIONS[before.status].includes('refunded')) {
        throw new Error(
          `Cannot transition order ${before.number} from "${before.status}" to "refunded"`,
        )
      }
      // Real money moves before our own record says "refunded" — if the gateway call
      // fails, the order stays in its previous status rather than lying about a refund
      // that never happened.
      if (before.paymentProvider && before.paymentReference) {
        await payments?.get(before.paymentProvider)?.refund?.(before.paymentReference)
      }
      const updated = await transition(id, 'refunded', 'order.refunded')
      if (stock) {
        for (const li of before.lineItems) {
          if (li.variantId) await stock.uncommit(li.variantId, li.quantity)
        }
      }
      return updated
    },

    async refundPartial(id, amount) {
      const order = await loadOrderOrThrow(id)
      if (order.status !== 'paid' && order.status !== 'fulfilled') {
        throw new Error(`Cannot refund order ${order.number} with status "${order.status}"`)
      }
      if (amount <= 0) throw new Error('Refund amount must be positive')
      const newRefunded = order.refundedAmount + amount
      if (newRefunded > order.totalAmount) {
        throw new Error(`Refund amount (${newRefunded}) exceeds order total (${order.totalAmount})`)
      }
      if (order.paymentProvider && order.paymentReference) {
        await payments?.get(order.paymentProvider)?.refund?.(order.paymentReference, amount)
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

    async reorder(orderId, customerId) {
      if (!cart) throw new Error('Reorder requires the cart service')
      const original = await loadOrderOrThrow(orderId)
      if (original.customerId !== customerId) {
        throw new Error(`Order ${orderId} does not belong to this customer`)
      }

      const newCart = await cart.create({ currency: original.currency, customerId })
      const skippedLineItems: ReorderResult['skippedLineItems'] = []
      for (const li of original.lineItems) {
        if (!li.variantId) {
          skippedLineItems.push({ productName: li.productName, reason: 'no longer available' })
          continue
        }
        try {
          await cart.addItem(newCart.id, li.variantId, li.quantity)
        } catch (err) {
          skippedLineItems.push({
            productName: li.productName,
            reason: err instanceof Error ? err.message : 'unavailable',
          })
        }
      }

      const refreshedCart = await db.query.carts.findFirst({
        where: eq(carts.id, newCart.id),
        with: { lineItems: true },
      })
      if (!refreshedCart || refreshedCart.lineItems.length === 0) {
        throw new Error('None of the items from this order are still available')
      }

      // Off-session charge against the customer's default saved payment
      // method, if one exists and the provider supports it. Any failure —
      // no payment method, unsupported provider, declined charge — falls
      // back to handing the cart to normal checkout rather than throwing,
      // since the cart itself was still built successfully.
      const pm = await db.query.customerPaymentMethods.findFirst({
        where: and(
          eq(customerPaymentMethods.customerId, customerId),
          eq(customerPaymentMethods.isDefault, true),
        ),
      })
      const provider = pm && payments ? payments.get(pm.provider) : undefined
      if (pm && provider?.chargeOffSession) {
        const amount = refreshedCart.lineItems.reduce(
          (sum, li) => sum + li.unitPriceAmount * li.quantity,
          0,
        )
        try {
          const intent = await provider.chargeOffSession({
            customerRef: pm.providerCustomerId,
            paymentMethodRef: pm.providerPaymentMethodId,
            amount,
            currency: original.currency,
            metadata: { reorderOf: orderId },
          })
          if (intent.status === 'succeeded') {
            const created = await service.createFromCart(newCart.id, {
              customerEmail: original.customerEmail,
            })
            await service.setPaymentReference(created.id, provider.name, intent.id)
            await service.markPaid(created.id)
            // Re-fetch — createFromCart's own return value predates the
            // paymentReference/markPaid mutations above.
            const paid = await service.get(created.id)
            if (!paid) throw new Error(`Order ${created.id} not found after markPaid`)
            return { order: paid, cartId: null, skippedLineItems }
          }
        } catch {
          // Falls through to the cartId-only result below.
        }
      }

      return { order: null, cartId: newCart.id, skippedLineItems }
    },
  }
  return service
}
