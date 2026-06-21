import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type LoyaltyAccount,
  type LoyaltyTransaction,
  loyaltyAccounts,
  loyaltyTransactions,
} from '../db/schema.js'

export type LoyaltyService = {
  getOrCreateAccount(customerId: string): Promise<LoyaltyAccount>
  getBalance(customerId: string): Promise<number>
  earn(
    customerId: string,
    orderId: string | undefined,
    orderTotalCents: number,
    earnRate: number,
  ): Promise<LoyaltyTransaction>
  redeem(
    customerId: string,
    points: number,
    description: string,
    orderId?: string | undefined,
  ): Promise<LoyaltyTransaction>
  adjust(
    customerId: string,
    points: number,
    description: string,
  ): Promise<LoyaltyTransaction>
  getTransactions(
    customerId: string,
    opts?: { limit?: number | undefined },
  ): Promise<LoyaltyTransaction[]>
  /** Preview how many cents a given number of points is worth. */
  previewRedeem(points: number, redeemRate: number): number
}

export function createLoyaltyService(db: DbClient): LoyaltyService {
  async function getOrCreate(customerId: string): Promise<LoyaltyAccount> {
    const existing = await db.query.loyaltyAccounts.findFirst({
      where: eq(loyaltyAccounts.customerId, customerId),
    })
    if (existing) return existing
    const [created] = await db
      .insert(loyaltyAccounts)
      .values({ customerId, balance: 0 })
      .returning()
    if (!created) throw new Error('Failed to create loyalty account')
    return created
  }

  return {
    getOrCreateAccount: getOrCreate,

    async getBalance(customerId) {
      const account = await db.query.loyaltyAccounts.findFirst({
        where: eq(loyaltyAccounts.customerId, customerId),
        columns: { balance: true },
      })
      return account?.balance ?? 0
    },

    async earn(customerId, orderId, orderTotalCents, earnRate) {
      const points = Math.floor((orderTotalCents / 100) * earnRate)
      const account = await getOrCreate(customerId)

      if (points <= 0) {
        const base = { accountId: account.id, type: 'earn' as const, points: 0, description: 'Points earned (order too small)' }
        const values = orderId !== undefined ? { ...base, orderId } : base
        const [tx] = await db.insert(loyaltyTransactions).values(values).returning()
        if (!tx) throw new Error('Failed to record loyalty transaction')
        return tx
      }

      const newBalance = account.balance + points
      await db
        .update(loyaltyAccounts)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(loyaltyAccounts.id, account.id))
      const base = { accountId: account.id, type: 'earn' as const, points, description: 'Points earned on order' }
      const values = orderId !== undefined ? { ...base, orderId } : base
      const [tx] = await db.insert(loyaltyTransactions).values(values).returning()
      if (!tx) throw new Error('Failed to record loyalty transaction')
      return tx
    },

    async redeem(customerId, points, description, orderId) {
      if (points <= 0) throw new Error('Points to redeem must be positive')
      const account = await getOrCreate(customerId)
      if (account.balance < points) {
        throw new Error(`Insufficient loyalty points (balance: ${account.balance}, requested: ${points})`)
      }
      const newBalance = account.balance - points
      await db
        .update(loyaltyAccounts)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(loyaltyAccounts.id, account.id))
      const values: typeof loyaltyTransactions.$inferInsert = {
        accountId: account.id,
        type: 'spend',
        points: -points,
        description,
      }
      if (orderId) values.orderId = orderId
      const [tx] = await db.insert(loyaltyTransactions).values(values).returning()
      if (!tx) throw new Error('Failed to record loyalty transaction')
      return tx
    },

    async adjust(customerId, points, description) {
      const account = await getOrCreate(customerId)
      const newBalance = Math.max(0, account.balance + points)
      await db
        .update(loyaltyAccounts)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(loyaltyAccounts.id, account.id))
      const [tx] = await db
        .insert(loyaltyTransactions)
        .values({
          accountId: account.id,
          type: 'adjust',
          points,
          description,
        })
        .returning()
      if (!tx) throw new Error('Failed to record loyalty transaction')
      return tx
    },

    async getTransactions(customerId, { limit = 20 } = {}) {
      const account = await db.query.loyaltyAccounts.findFirst({
        where: eq(loyaltyAccounts.customerId, customerId),
      })
      if (!account) return []
      return db.query.loyaltyTransactions.findMany({
        where: eq(loyaltyTransactions.accountId, account.id),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit,
      })
    },

    previewRedeem(points, redeemRate) {
      return Math.floor(points * redeemRate)
    },
  }
}
