import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, inArray } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type Seller,
  type SellerEarning,
  type SellerPayout,
  orderLineItems,
  orders,
  sellerEarnings,
  sellerPayouts,
  sellers,
} from '../db/schema.js'

const scryptAsync = promisify(scrypt)

export type { Seller, SellerEarning, SellerPayout }

export type RegisterSellerInput = {
  email: string
  password: string
  storeName: string
  contactEmail?: string | undefined
}

export type SellerOrderSummary = {
  orderId: string
  orderNumber: string
  orderStatus: string
  createdAt: Date
  /** This seller's own line items within the order — other sellers' items aren't included. */
  lineItems: Array<{
    id: string
    productName: string
    variantName: string
    sku: string
    quantity: number
    unitPriceAmount: number
    totalAmount: number
  }>
  grossAmount: number
}

export type SellerService = {
  register(input: RegisterSellerInput): Promise<Seller>
  login(email: string, password: string): Promise<Seller | null>
  get(id: string): Promise<Seller | null>
  list(opts?: { status?: Seller['status'] | undefined }): Promise<Seller[]>
  setStatus(id: string, status: Seller['status']): Promise<Seller>
  setCommissionRate(id: string, commissionRateBp: number | null): Promise<Seller>
  listOrders(sellerId: string): Promise<SellerOrderSummary[]>
  listEarnings(sellerId: string): Promise<SellerEarning[]>
  /**
   * Sums every 'available' earning for a seller into a payout, marking them
   * 'paid_out'. Recording the transfer/deposit itself is out of scope here —
   * this is a ledger, not a payment rail integration.
   */
  createPayout(sellerId: string, note?: string): Promise<SellerPayout>
  /**
   * Computes and records this order's commission split for every seller
   * whose line items appear in it. Idempotent (unique seller+order index).
   * Simplification: earnings aren't clawed back on a later refund/return —
   * a real payout run would need to net that out, deliberately out of scope.
   */
  recordEarningsForOrder(orderId: string, defaultCommissionRateBp: number): Promise<void>
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

const DUMMY_HASH = `${'a'.repeat(32)}:${'b'.repeat(128)}`

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return derived.length === hashBuf.length && timingSafeEqual(derived, hashBuf)
}

export function createSellerService(db: DbClient): SellerService {
  return {
    async register({ email, password, storeName, contactEmail }) {
      const existing = await db.query.sellers.findFirst({
        where: eq(sellers.email, email.toLowerCase()),
      })
      if (existing) throw new Error(`A seller account with email ${email} already exists`)
      const passwordHash = await hashPassword(password)
      const [seller] = await db
        .insert(sellers)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          storeName,
          contactEmail: contactEmail ?? null,
        })
        .returning()
      if (!seller) throw new Error('Failed to register seller')
      return seller
    },

    async login(email, password) {
      const seller = await db.query.sellers.findFirst({
        where: eq(sellers.email, email.toLowerCase()),
      })
      const valid = await verifyPassword(password, seller?.passwordHash ?? DUMMY_HASH)
      if (!seller || seller.status === 'suspended' || !valid) return null
      return seller
    },

    async get(id) {
      return (await db.query.sellers.findFirst({ where: eq(sellers.id, id) })) ?? null
    },

    async list({ status } = {}) {
      return db.query.sellers.findMany({
        where: status ? eq(sellers.status, status) : undefined,
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
    },

    async setStatus(id, status) {
      const [seller] = await db
        .update(sellers)
        .set({ status, updatedAt: new Date() })
        .where(eq(sellers.id, id))
        .returning()
      if (!seller) throw new Error(`Seller ${id} not found`)
      return seller
    },

    async setCommissionRate(id, commissionRateBp) {
      const [seller] = await db
        .update(sellers)
        .set({ commissionRateBp, updatedAt: new Date() })
        .where(eq(sellers.id, id))
        .returning()
      if (!seller) throw new Error(`Seller ${id} not found`)
      return seller
    },

    async listOrders(sellerId) {
      const lineItems = await db.query.orderLineItems.findMany({
        where: eq(orderLineItems.sellerId, sellerId),
        orderBy: (li, { desc }) => [desc(li.createdAt)],
      })
      if (lineItems.length === 0) return []
      const orderIds = [...new Set(lineItems.map((li) => li.orderId))]
      const orderRows = await db.query.orders.findMany({ where: inArray(orders.id, orderIds) })
      const orderById = new Map(orderRows.map((o) => [o.id, o]))
      const byOrder = new Map<string, typeof lineItems>()
      for (const li of lineItems) {
        const list = byOrder.get(li.orderId) ?? []
        list.push(li)
        byOrder.set(li.orderId, list)
      }
      const summaries: SellerOrderSummary[] = []
      for (const [orderId, items] of byOrder) {
        const order = orderById.get(orderId)
        if (!order) continue
        summaries.push({
          orderId,
          orderNumber: order.number,
          orderStatus: order.status,
          createdAt: order.createdAt,
          lineItems: items.map((li) => ({
            id: li.id,
            productName: li.productName,
            variantName: li.variantName,
            sku: li.sku,
            quantity: li.quantity,
            unitPriceAmount: li.unitPriceAmount,
            totalAmount: li.totalAmount,
          })),
          grossAmount: items.reduce((sum, li) => sum + li.totalAmount, 0),
        })
      }
      return summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    async listEarnings(sellerId) {
      return db.query.sellerEarnings.findMany({
        where: eq(sellerEarnings.sellerId, sellerId),
        orderBy: (e, { desc }) => [desc(e.createdAt)],
      })
    },

    async createPayout(sellerId, note) {
      return db.transaction(async (tx) => {
        const available = await tx.query.sellerEarnings.findMany({
          where: and(eq(sellerEarnings.sellerId, sellerId), eq(sellerEarnings.status, 'available')),
        })
        if (available.length === 0) throw new Error('No available earnings to pay out')
        const currency = available[0]?.currency ?? 'EUR'
        const amount = available.reduce((sum, e) => sum + e.netAmount, 0)
        const [payout] = await tx
          .insert(sellerPayouts)
          .values({ sellerId, amount, currency, note: note ?? null })
          .returning()
        if (!payout) throw new Error('Failed to create payout')
        await tx
          .update(sellerEarnings)
          .set({ status: 'paid_out', payoutId: payout.id })
          .where(
            inArray(
              sellerEarnings.id,
              available.map((e) => e.id),
            ),
          )
        return payout
      })
    },

    async recordEarningsForOrder(orderId, defaultCommissionRateBp) {
      const lineItems = await db.query.orderLineItems.findMany({
        where: eq(orderLineItems.orderId, orderId),
      })
      const bySeller = new Map<string, number>()
      for (const li of lineItems) {
        if (!li.sellerId) continue
        bySeller.set(li.sellerId, (bySeller.get(li.sellerId) ?? 0) + li.totalAmount)
      }
      if (bySeller.size === 0) return

      const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
      if (!order) return

      for (const [sellerId, grossAmount] of bySeller) {
        const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) })
        const rateBp = seller?.commissionRateBp ?? defaultCommissionRateBp
        const commissionAmount = Math.round((grossAmount * rateBp) / 10000)
        const netAmount = grossAmount - commissionAmount
        await db
          .insert(sellerEarnings)
          .values({
            sellerId,
            orderId,
            grossAmount,
            commissionAmount,
            netAmount,
            currency: order.currency,
          })
          .onConflictDoNothing()
      }
    },
  }
}
