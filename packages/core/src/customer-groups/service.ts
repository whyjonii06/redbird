import { and, eq, inArray, lte } from 'drizzle-orm'
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
  create(input: {
    name: string
    description?: string
    paymentTermsDays?: number | null
  }): Promise<CustomerGroup>
  update(
    id: string,
    patch: { name?: string; description?: string | null; paymentTermsDays?: number | null },
  ): Promise<CustomerGroup>
  delete(id: string): Promise<void>
  /**
   * The most generous net-payment terms (highest day count) across every group
   * this customer belongs to. Null = not eligible for purchase-order checkout —
   * their groups either have no terms set or they belong to no group at all.
   */
  getPaymentTermsDays(customerId: string): Promise<number | null>

  addMember(groupId: string, customerId: string): Promise<void>
  removeMember(groupId: string, customerId: string): Promise<void>
  listMembers(groupId: string): Promise<Array<{ customerId: string }>>

  /** minQuantity defaults to 1 (the "standard" tier for this group). */
  setPriceRule(
    groupId: string,
    variantId: string,
    priceAmount: number,
    priceCurrency: string,
    minQuantity?: number,
  ): Promise<GroupPriceRule>
  removePriceRule(id: string): Promise<void>
  /** Ordered by variant, then ascending quantity tier. */
  listPriceRules(groupId: string): Promise<GroupPriceRule[]>
  /**
   * Returns the best group price for a variant at the given line-item quantity —
   * the highest quantity tier the customer qualifies for, across all of their
   * groups. Ties broken by lowest price. Null if no group/rule applies.
   */
  getGroupPrice(
    customerId: string,
    variantId: string,
    quantity?: number,
  ): Promise<{ priceAmount: number; priceCurrency: string } | null>
  /**
   * All quantity tiers this customer qualifies for on a variant, across their
   * groups, merged into one ascending-quantity price ladder (lowest price wins
   * on a tie). For displaying a "buy more, save more" table on the storefront.
   */
  listApplicableTiers(
    customerId: string,
    variantId: string,
  ): Promise<Array<{ minQuantity: number; priceAmount: number; priceCurrency: string }>>
}

export function createCustomerGroupService(db: DbClient): CustomerGroupService {
  return {
    async list() {
      return db.query.customerGroups.findMany({ orderBy: (g, { asc }) => [asc(g.name)] })
    },

    async get(id) {
      return (await db.query.customerGroups.findFirst({ where: eq(customerGroups.id, id) })) ?? null
    },

    async create({ name, description, paymentTermsDays }) {
      const [row] = await db
        .insert(customerGroups)
        .values({
          name,
          description: description ?? null,
          paymentTermsDays: paymentTermsDays ?? null,
        })
        .returning()
      if (!row) throw new Error('Failed to create customer group')
      return row
    },

    async update(id, patch) {
      const set: Partial<typeof customerGroups.$inferInsert> = { updatedAt: new Date() }
      if (patch.name !== undefined) set.name = patch.name
      if (patch.description !== undefined) set.description = patch.description
      if (patch.paymentTermsDays !== undefined) set.paymentTermsDays = patch.paymentTermsDays
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
      await db.insert(customerGroupMembers).values({ groupId, customerId }).onConflictDoNothing()
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

    async setPriceRule(groupId, variantId, priceAmount, priceCurrency, minQuantity = 1) {
      const [row] = await db
        .insert(groupPriceRules)
        .values({ groupId, variantId, priceAmount, priceCurrency, minQuantity })
        .onConflictDoUpdate({
          target: [groupPriceRules.groupId, groupPriceRules.variantId, groupPriceRules.minQuantity],
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
        orderBy: (r, { asc }) => [asc(r.variantId), asc(r.minQuantity)],
      })
    },

    async getGroupPrice(customerId, variantId, quantity = 1) {
      const memberships = await db.query.customerGroupMembers.findMany({
        where: eq(customerGroupMembers.customerId, customerId),
        columns: { groupId: true },
      })
      if (memberships.length === 0) return null
      const groupIds = memberships.map((m) => m.groupId)

      const rules = await db.query.groupPriceRules.findMany({
        where: and(
          inArray(groupPriceRules.groupId, groupIds),
          eq(groupPriceRules.variantId, variantId),
          lte(groupPriceRules.minQuantity, quantity),
        ),
      })
      if (rules.length === 0) return null

      // Prefer the highest quantity tier reached (most specific discount);
      // tie-break by lowest price if multiple groups both qualify.
      rules.sort((a, b) => b.minQuantity - a.minQuantity || a.priceAmount - b.priceAmount)
      const best = rules[0]
      if (!best) return null
      return { priceAmount: best.priceAmount, priceCurrency: best.priceCurrency }
    },

    async getPaymentTermsDays(customerId) {
      const memberships = await db.query.customerGroupMembers.findMany({
        where: eq(customerGroupMembers.customerId, customerId),
        columns: { groupId: true },
      })
      if (memberships.length === 0) return null
      const groupIds = memberships.map((m) => m.groupId)

      const groups = await db.query.customerGroups.findMany({
        where: inArray(customerGroups.id, groupIds),
        columns: { paymentTermsDays: true },
      })
      const days = groups
        .map((g) => g.paymentTermsDays)
        .filter((d): d is number => d !== null && d > 0)
      return days.length > 0 ? Math.max(...days) : null
    },

    async listApplicableTiers(customerId, variantId) {
      const memberships = await db.query.customerGroupMembers.findMany({
        where: eq(customerGroupMembers.customerId, customerId),
        columns: { groupId: true },
      })
      if (memberships.length === 0) return []
      const groupIds = memberships.map((m) => m.groupId)

      const rules = await db.query.groupPriceRules.findMany({
        where: and(
          inArray(groupPriceRules.groupId, groupIds),
          eq(groupPriceRules.variantId, variantId),
        ),
      })
      if (rules.length === 0) return []

      const byMinQuantity = new Map<number, GroupPriceRule>()
      for (const rule of rules) {
        const existing = byMinQuantity.get(rule.minQuantity)
        if (!existing || rule.priceAmount < existing.priceAmount) {
          byMinQuantity.set(rule.minQuantity, rule)
        }
      }
      return [...byMinQuantity.values()]
        .sort((a, b) => a.minQuantity - b.minQuantity)
        .map((r) => ({
          minQuantity: r.minQuantity,
          priceAmount: r.priceAmount,
          priceCurrency: r.priceCurrency,
        }))
    },
  }
}
