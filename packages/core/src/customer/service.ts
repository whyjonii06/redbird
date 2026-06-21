import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { eq, ilike, or } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type PublicCustomer, customers, orders, productReviews } from '../db/schema.js'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return derived.length === hashBuf.length && timingSafeEqual(derived, hashBuf)
}

function toPublic(c: {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  createdAt: Date
  updatedAt: Date
  passwordHash: string
  resetToken: string | null
  resetTokenExpiresAt: Date | null
}): PublicCustomer {
  const { passwordHash: _h, resetToken: _t, resetTokenExpiresAt: _e, ...pub } = c
  void _h
  void _t
  void _e
  return pub
}

export type RegisterInput = {
  email: string
  password: string
  firstName?: string | undefined
  lastName?: string | undefined
}

export type UpdateCustomerInput = {
  firstName?: string | undefined
  lastName?: string | undefined
}

export type CustomerService = {
  register(input: RegisterInput): Promise<PublicCustomer>
  login(email: string, password: string): Promise<PublicCustomer | null>
  get(id: string): Promise<PublicCustomer | null>
  getByEmail(email: string): Promise<PublicCustomer | null>
  list(opts?: { limit?: number; offset?: number; search?: string }): Promise<PublicCustomer[]>
  update(id: string, patch: UpdateCustomerInput): Promise<PublicCustomer>
  /** Generate a 1-hour reset token. Returns null if email not found. */
  createResetToken(email: string): Promise<{ token: string; customerId: string } | null>
  /** Validate token, set new password, clear token. Throws if token invalid/expired. */
  resetPassword(token: string, newPassword: string): Promise<PublicCustomer>
  /** GDPR — anonymise all PII. The account row is kept for referential integrity. */
  deleteAccount(id: string): Promise<void>
  /** GDPR — return all data held for this customer as a portable JSON object. */
  exportData(id: string): Promise<{
    exportedAt: string
    profile: PublicCustomer | null
    orders: unknown[]
    reviews: unknown[]
  }>
}

export function createCustomerService(db: DbClient): CustomerService {
  return {
    async register({ email, password, firstName, lastName }) {
      const existing = await db.query.customers.findFirst({
        where: eq(customers.email, email.toLowerCase()),
      })
      if (existing) throw new Error(`Email ${email} is already registered`)

      const passwordHash = await hashPassword(password)
      const [customer] = await db
        .insert(customers)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
        })
        .returning()
      if (!customer) throw new Error('Failed to create customer')
      return toPublic(customer)
    },

    async login(email, password) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.email, email.toLowerCase()),
      })
      if (!customer) return null
      const valid = await verifyPassword(password, customer.passwordHash)
      if (!valid) return null
      return toPublic(customer)
    },

    async get(id) {
      const row = await db.query.customers.findFirst({
        where: eq(customers.id, id),
      })
      return row ? toPublic(row) : null
    },

    async getByEmail(email) {
      const row = await db.query.customers.findFirst({
        where: eq(customers.email, email.toLowerCase()),
      })
      return row ? toPublic(row) : null
    },

    async list({ limit = 50, offset = 0, search } = {}) {
      const rows = await db.query.customers.findMany({
        where: search
          ? or(ilike(customers.email, `%${search}%`), ilike(customers.firstName, `%${search}%`), ilike(customers.lastName, `%${search}%`))
          : undefined,
        orderBy: (c, { desc }) => [desc(c.createdAt)],
        limit,
        offset,
      })
      return rows.map(toPublic)
    },

    async update(id, patch) {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.firstName !== undefined) set.firstName = patch.firstName
      if (patch.lastName !== undefined) set.lastName = patch.lastName

      const [updated] = await db.update(customers).set(set).where(eq(customers.id, id)).returning()
      if (!updated) throw new Error(`Customer ${id} not found`)
      return toPublic(updated)
    },

    async createResetToken(email) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.email, email.toLowerCase()),
      })
      if (!customer) return null
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await db
        .update(customers)
        .set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(customers.id, customer.id))
      return { token, customerId: customer.id }
    },

    async deleteAccount(id) {
      await db
        .update(customers)
        .set({
          email: `deleted-${id}@redbird.deleted`,
          firstName: null,
          lastName: null,
          passwordHash: randomBytes(32).toString('hex'),
          resetToken: null,
          resetTokenExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
      // Anonymise PII on orders (email is notNull so replace with placeholder)
      await db
        .update(orders)
        .set({ customerEmail: 'deleted@redbird.deleted' })
        .where(eq(orders.customerId, id))
      // Unlink reviews (customerId is nullable via ON DELETE SET NULL pattern)
      await db
        .update(productReviews)
        .set({ customerId: null, customerName: 'Anonymous' })
        .where(eq(productReviews.customerId, id))
    },

    async exportData(id) {
      const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) })
      const profile = customer ? toPublic(customer) : null
      const orderList = await db.query.orders.findMany({
        where: eq(orders.customerId, id),
        with: { lineItems: true },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      })
      const reviewList = await db.query.productReviews.findMany({
        where: eq(productReviews.customerId, id),
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      })
      return {
        exportedAt: new Date().toISOString(),
        profile,
        orders: orderList,
        reviews: reviewList,
      }
    },

    async resetPassword(token, newPassword) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.resetToken, token),
      })
      if (!customer) throw new Error('Invalid or expired reset token')
      if (!customer.resetTokenExpiresAt || customer.resetTokenExpiresAt < new Date()) {
        throw new Error('Reset token has expired')
      }
      const passwordHash = await hashPassword(newPassword)
      const [updated] = await db
        .update(customers)
        .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() })
        .where(eq(customers.id, customer.id))
        .returning()
      if (!updated) throw new Error('Failed to reset password')
      return toPublic(updated)
    },
  }
}
