import { and, eq } from 'drizzle-orm'
import type { CartService } from '../cart/service.js'
import type { DbClient } from '../db/client.js'
import { type RegisterSession, orders, registerSessions, staff } from '../db/schema.js'
import type { OrderService, OrderWithItems } from '../order/service.js'

export type RegisterSessionSummary = RegisterSession & {
  staffEmail: string
  /** Net (sale minus refund) cash and card totals rung up during this session. */
  cashSalesAmount: number
  cardSalesAmount: number
  orderCount: number
  /** opening float + net cash sales — what should be in the drawer at close. */
  expectedCashAmount: number
}

export type RingSaleItemInput = { variantId: string; quantity: number }

export type RingSaleInput = {
  registerSessionId: string
  items: RingSaleItemInput[]
  tenderType: 'cash' | 'card'
  /** Cash handed over by the customer — used to compute change due. Ignored for card. */
  cashReceived?: number | undefined
  customerId?: string | undefined
  customerEmail?: string | undefined
}

export type PosService = {
  openSession(staffId: string, openingCashAmount: number, notes?: string): Promise<RegisterSession>
  /** The staff member's currently open session, if any — a cashier can only have one at a time. */
  getOpenSession(staffId: string): Promise<RegisterSessionSummary | null>
  closeSession(id: string, closingCashAmount: number): Promise<RegisterSessionSummary>
  listSessions(opts?: { status?: 'open' | 'closed' | undefined }): Promise<RegisterSessionSummary[]>
  get(id: string): Promise<RegisterSessionSummary | null>
  /** Builds a cart, creates and immediately pays an order (no shipping) — an in-person sale. */
  ringSale(input: RingSaleInput): Promise<{ order: OrderWithItems; changeDue: number }>
}

export function createPosService(
  db: DbClient,
  cart: CartService,
  orderSvc: OrderService,
  defaultCurrency: string,
): PosService {
  async function summarize(session: RegisterSession): Promise<RegisterSessionSummary> {
    const [staffMember, linkedOrders] = await Promise.all([
      db.query.staff.findFirst({ where: eq(staff.id, session.staffId) }),
      db.query.orders.findMany({ where: eq(orders.registerSessionId, session.id) }),
    ])
    let cashSalesAmount = 0
    let cardSalesAmount = 0
    for (const o of linkedOrders) {
      const net = o.totalAmount - o.refundedAmount
      if (o.paymentProvider === '@redbird/pos-cash') cashSalesAmount += net
      else cardSalesAmount += net
    }
    return {
      ...session,
      staffEmail: staffMember?.email ?? 'unknown',
      cashSalesAmount,
      cardSalesAmount,
      orderCount: linkedOrders.length,
      expectedCashAmount: session.openingCashAmount + cashSalesAmount,
    }
  }

  return {
    async openSession(staffId, openingCashAmount, notes) {
      const existing = await db.query.registerSessions.findFirst({
        where: and(eq(registerSessions.staffId, staffId), eq(registerSessions.status, 'open')),
      })
      if (existing) throw new Error('You already have an open register session')
      const [session] = await db
        .insert(registerSessions)
        .values({ staffId, openingCashAmount, notes: notes ?? null })
        .returning()
      if (!session) throw new Error('Failed to open register session')
      return session
    },

    async getOpenSession(staffId) {
      const session = await db.query.registerSessions.findFirst({
        where: and(eq(registerSessions.staffId, staffId), eq(registerSessions.status, 'open')),
      })
      return session ? summarize(session) : null
    },

    async closeSession(id, closingCashAmount) {
      const existing = await db.query.registerSessions.findFirst({
        where: eq(registerSessions.id, id),
      })
      if (!existing) throw new Error(`Register session ${id} not found`)
      if (existing.status !== 'open') throw new Error(`Register session ${id} is already closed`)
      const [session] = await db
        .update(registerSessions)
        .set({ status: 'closed', closingCashAmount, closedAt: new Date() })
        .where(eq(registerSessions.id, id))
        .returning()
      if (!session) throw new Error(`Register session ${id} not found`)
      return summarize(session)
    },

    async listSessions({ status } = {}) {
      const rows = await db.query.registerSessions.findMany({
        where: status ? eq(registerSessions.status, status) : undefined,
        orderBy: (s, { desc }) => [desc(s.openedAt)],
      })
      return Promise.all(rows.map(summarize))
    },

    async get(id) {
      const session = await db.query.registerSessions.findFirst({
        where: eq(registerSessions.id, id),
      })
      return session ? summarize(session) : null
    },

    async ringSale({
      registerSessionId,
      items,
      tenderType,
      cashReceived,
      customerId,
      customerEmail,
    }) {
      if (items.length === 0) throw new Error('At least one item is required')
      const session = await db.query.registerSessions.findFirst({
        where: eq(registerSessions.id, registerSessionId),
      })
      if (!session) throw new Error(`Register session ${registerSessionId} not found`)
      if (session.status !== 'open') throw new Error('This register session is closed')

      const newCart = await cart.create({
        currency: defaultCurrency,
        ...(customerId ? { customerId } : {}),
      })
      for (const item of items) {
        await cart.addItem(newCart.id, item.variantId, item.quantity)
      }

      const created = await orderSvc.createFromCart(newCart.id, {
        customerEmail: customerEmail ?? 'walk-in@pos.local',
        shippingAmount: 0,
      })
      await db.update(orders).set({ registerSessionId }).where(eq(orders.id, created.id))
      const provider = tenderType === 'cash' ? '@redbird/pos-cash' : '@redbird/pos-card'
      await orderSvc.setPaymentReference(created.id, provider, `pos-${created.number}`)
      await orderSvc.markPaid(created.id)

      const paid = await orderSvc.get(created.id)
      if (!paid) throw new Error(`Order ${created.id} not found after payment`)

      const changeDue =
        tenderType === 'cash' && cashReceived != null
          ? Math.max(0, cashReceived - paid.totalAmount)
          : 0

      return { order: paid, changeDue }
    },
  }
}
