import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type CustomerGroup,
  type GroupPriceRule,
  customerGroupMembers,
  customerGroups,
  groupPriceRules,
} from '../db/schema.js'

export type CustomerGroupService = {
  list(): Promise<CustomerGroup[]>
  get(id: string): Promise<CustomerGroup | null>
  create(input: { name: string; description?: string }): Promise<CustomerGroup>
  update(id: string, patch: { name?: string; description?: string | null }): Promise<CustomerGroup>
  delete(id: string): Promise<void>

  addMember(groupId: string, customerId: string): Promise<void>
  removeMember(groupId: string, customerId: string): Promise<void>
  listMembers(groupId: string): Promise<Array<{ customerId: string }>>

  setPriceRule(groupId: string, variantId: string, priceAmount: number, priceCurrency: string): Promise<GroupPriceRule>
  removePriceRule(id: string): Promise<void>
  listPriceRules(groupId: string): Promise<GroupPriceRule[]>
  /** Returns the group-specific price for a variant for a given customer, or null if no rule applies. */
  getGroupPrice(
    customerId: string,
    variantId: string,
  ): Promise<{ priceAmount: number; priceCurrency: string } | null>
}

export function createCustomerGroupService(db: DbClient): CustomerGroupService {
  return {
    async list() {
      return db.query.customerGroups.findMany({ orderBy: (g, { asc }) => [asc(g.name)] })
    },

    async get(id) {
      return (await db.query.customerGroups.findFirst({ where: eq(customerGroups.id, id) })) ?? null
    },

    async create({ name, description }) {
      const [row] = await db
        .insert(customerGroups)
        .values({ name, description: description ?? null })
        .returning()
      if (!row) throw new Error('Failed to create customer group')
      return row
    },

    async update(id, patch) {
      const set: Partial<typeof customerGroups.$inferInsert> = { updatedAt: new Date() }
      if (patch.name !== undefined) set.name = patch.name
      if (patch.description !== undefined) set.description = patch.description
      const [row] = await db
        .update(customerGroups)
        .set(set)
        .where(eq(customerGroups.id, id))
        .returning()
      if (!row) throw new Error(`Customer group ${id} not found`)
      return row
    },

    async delete(id) {
      await db.delete(customerGroups).where(eq(customerGroups.id, id))
    },

    async addMember(groupId, customerId) {
      await db
        .insert(customerGroupMembers)
        .values({ groupId, customerId })
        .onConflictDoNothing()
    },

    async removeMember(groupId, customerId) {
      await db
        .delete(customerGroupMembers)
        .where(
          and(
            eq(customerGroupMembers.groupId, groupId),
            eq(customerGroupMembers.customerId, customerId),
          ),
        )
    },

    async listMembers(groupId) {
      const rows = await db.query.customerGroupMembers.findMany({
        where: eq(customerGroupMembers.groupId, groupId),
        columns: { customerId: true },
      })
      return rows
    },

    async setPriceRule(groupId, variantId, priceAmount, priceCurrency) {
      const [row] = await db
        .insert(groupPriceRules)
        .values({ groupId, variantId, priceAmount, priceCurrency })
        .onConflictDoUpdate({
          target: [groupPriceRules.groupId, groupPriceRules.variantId],
          set: { priceAmount, priceCurrency },
        })
        .returning()
      if (!row) throw new Error('Failed to set price rule')
      return row
    },

    async removePriceRule(id) {
      await db.delete(groupPriceRules).where(eq(groupPriceRules.id, id))
    },

    async listPriceRules(groupId) {
      return db.query.groupPriceRules.findMany({
        where: eq(groupPriceRules.groupId, groupId),
      })
    },

    async getGroupPrice(customerId, variantId) {
      const memberships = await db.query.customerGroupMembers.findMany({
        where: eq(customerGroupMembers.customerId, customerId),
        columns: { groupId: true },
      })
      if (memberships.length === 0) return null

      const groupIds = memberships.map((m) => m.groupId)
      for (const groupId of groupIds) {
        const rule = await db.query.groupPriceRules.findFirst({
          where: (r, { and, eq: eqFn }) =>
            and(eqFn(r.groupId, groupId), eqFn(r.variantId, variantId)),
        })
        if (rule) return { priceAmount: rule.priceAmount, priceCurrency: rule.priceCurrency }
      }
      return null
    },
  }
}
