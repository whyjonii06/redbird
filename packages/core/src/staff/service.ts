import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type StaffMember, type StaffRole, staff } from '../db/schema.js'

export type { StaffMember, StaffRole }

export type CreateStaffInput = {
  email: string
  password: string
  firstName?: string | undefined
  lastName?: string | undefined
  role?: StaffRole | undefined
}

export type StaffService = {
  create(input: CreateStaffInput): Promise<StaffMember>
  login(email: string, password: string): Promise<StaffMember | null>
  get(id: string): Promise<StaffMember | null>
  getByEmail(email: string): Promise<StaffMember | null>
  list(): Promise<StaffMember[]>
  update(
    id: string,
    data: {
      firstName?: string | undefined
      lastName?: string | undefined
      role?: StaffRole | undefined
      active?: boolean | undefined
    },
  ): Promise<StaffMember>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256')
    .update(salt + password)
    .digest('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const attempt = createHash('sha256')
    .update(salt + password)
    .digest('hex')
  const attemptBuf = Buffer.from(attempt, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')
  return attemptBuf.length === hashBuf.length && timingSafeEqual(attemptBuf, hashBuf)
}

export function createStaffService(db: DbClient): StaffService {
  return {
    async create({ email, password, firstName, lastName, role = 'support' }) {
      const existing = await db.query.staff.findFirst({
        where: eq(staff.email, email.toLowerCase()),
      })
      if (existing) throw new Error(`Staff member with email ${email} already exists`)
      const passwordHash = hashPassword(password)
      const [member] = await db
        .insert(staff)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          role,
        })
        .returning()
      if (!member) throw new Error('Failed to create staff member')
      return member
    },

    async login(email, password) {
      const member = await db.query.staff.findFirst({ where: eq(staff.email, email.toLowerCase()) })
      if (!member || !member.active) return null
      if (!verifyPassword(password, member.passwordHash)) return null
      return member
    },

    async get(id) {
      return (await db.query.staff.findFirst({ where: eq(staff.id, id) })) ?? null
    },

    async getByEmail(email) {
      return (
        (await db.query.staff.findFirst({ where: eq(staff.email, email.toLowerCase()) })) ?? null
      )
    },

    async list() {
      return db.query.staff.findMany({ orderBy: (s, { asc }) => [asc(s.createdAt)] })
    },

    async update(id, data) {
      const patch: Partial<StaffMember> = { updatedAt: new Date() }
      if (data.firstName !== undefined) patch.firstName = data.firstName
      if (data.lastName !== undefined) patch.lastName = data.lastName
      if (data.role !== undefined) patch.role = data.role
      if (data.active !== undefined) patch.active = data.active
      const [member] = await db.update(staff).set(patch).where(eq(staff.id, id)).returning()
      if (!member) throw new Error(`Staff member ${id} not found`)
      return member
    },

    async delete(id) {
      await db.delete(staff).where(eq(staff.id, id))
    },

    async count() {
      const rows = await db.query.staff.findMany({ columns: { id: true } })
      return rows.length
    },
  }
}
