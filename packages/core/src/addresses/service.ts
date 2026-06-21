import { and, asc, desc, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type CustomerAddress, customerAddresses } from '../db/schema.js'

export type { CustomerAddress }

export type CreateAddressInput = {
  label?: string | undefined
  firstName: string
  lastName: string
  line1: string
  line2?: string | undefined
  city: string
  postalCode: string
  countryCode: string
  phone?: string | undefined
  isDefault?: boolean | undefined
}

export type AddressService = {
  list(customerId: string): Promise<CustomerAddress[]>
  get(customerId: string, id: string): Promise<CustomerAddress | null>
  create(customerId: string, input: CreateAddressInput): Promise<CustomerAddress>
  update(customerId: string, id: string, patch: Partial<CreateAddressInput>): Promise<CustomerAddress>
  delete(customerId: string, id: string): Promise<void>
  setDefault(customerId: string, id: string): Promise<CustomerAddress>
}

export function createAddressService(db: DbClient): AddressService {
  return {
    async list(customerId) {
      return db.query.customerAddresses.findMany({
        where: eq(customerAddresses.customerId, customerId),
        orderBy: [desc(customerAddresses.isDefault), asc(customerAddresses.createdAt)],
      })
    },

    async get(customerId, id) {
      const row = await db.query.customerAddresses.findFirst({
        where: and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)),
      })
      return row ?? null
    },

    async create(customerId, input) {
      const existing = await db.query.customerAddresses.findMany({
        where: eq(customerAddresses.customerId, customerId),
      })
      const makeDefault = input.isDefault ?? existing.length === 0

      if (makeDefault && existing.length > 0) {
        await db
          .update(customerAddresses)
          .set({ isDefault: false })
          .where(eq(customerAddresses.customerId, customerId))
      }

      const [addr] = await db
        .insert(customerAddresses)
        .values({
          customerId,
          label: input.label ?? 'home',
          firstName: input.firstName,
          lastName: input.lastName,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          postalCode: input.postalCode,
          countryCode: input.countryCode.toUpperCase(),
          phone: input.phone ?? null,
          isDefault: makeDefault,
        })
        .returning()
      if (!addr) throw new Error('Failed to create address')
      return addr
    },

    async update(customerId, id, patch) {
      const existing = await db.query.customerAddresses.findFirst({
        where: and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)),
      })
      if (!existing) throw new Error(`Address ${id} not found`)

      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.label !== undefined) set['label'] = patch.label
      if (patch.firstName !== undefined) set['firstName'] = patch.firstName
      if (patch.lastName !== undefined) set['lastName'] = patch.lastName
      if (patch.line1 !== undefined) set['line1'] = patch.line1
      if (patch.line2 !== undefined) set['line2'] = patch.line2
      if (patch.city !== undefined) set['city'] = patch.city
      if (patch.postalCode !== undefined) set['postalCode'] = patch.postalCode
      if (patch.countryCode !== undefined) set['countryCode'] = patch.countryCode.toUpperCase()
      if (patch.phone !== undefined) set['phone'] = patch.phone

      const [updated] = await db
        .update(customerAddresses)
        .set(set)
        .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
        .returning()
      if (!updated) throw new Error(`Address ${id} not found`)
      return updated
    },

    async delete(customerId, id) {
      const addr = await db.query.customerAddresses.findFirst({
        where: and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)),
      })
      if (!addr) throw new Error(`Address ${id} not found`)

      await db
        .delete(customerAddresses)
        .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))

      // If deleted address was default, promote the oldest remaining one
      if (addr.isDefault) {
        const next = await db.query.customerAddresses.findFirst({
          where: eq(customerAddresses.customerId, customerId),
          orderBy: [asc(customerAddresses.createdAt)],
        })
        if (next) {
          await db
            .update(customerAddresses)
            .set({ isDefault: true })
            .where(eq(customerAddresses.id, next.id))
        }
      }
    },

    async setDefault(customerId, id) {
      await db
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, customerId))

      const [updated] = await db
        .update(customerAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
        .returning()
      if (!updated) throw new Error(`Address ${id} not found`)
      return updated
    },
  }
}
