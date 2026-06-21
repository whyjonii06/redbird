import { and, eq, gte, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { stockLevels } from '../db/schema.js'

export type StockInfo = {
  variantId: string
  available: number
  reserved: number
  committed: number
  /** available + reserved + committed */
  onHand: number
}

export type StockService = {
  /** Set absolute available quantity. Creates the entry if it doesn't exist. */
  set(variantId: string, quantity: number): Promise<StockInfo>
  /** Get current stock. Returns null if no entry exists (= unlimited). */
  get(variantId: string): Promise<StockInfo | null>
  /** Add or subtract from available (positive = restock, negative = adjustment). */
  adjust(variantId: string, delta: number): Promise<StockInfo>
  /** True if available >= quantity, or no stock entry (unlimited). */
  isAvailable(variantId: string, quantity: number): Promise<boolean>
  /** Move available → reserved. Throws if insufficient stock. No-op if no stock entry. */
  reserve(variantId: string, quantity: number): Promise<void>
  /** Move reserved → available. Clamps at 0 to avoid negative reserved. */
  release(variantId: string, quantity: number): Promise<void>
  /** Move reserved → committed (order paid). */
  commit(variantId: string, quantity: number): Promise<void>
  /** Move committed → available (order cancelled/refunded). */
  uncommit(variantId: string, quantity: number): Promise<void>
}

function toInfo(row: typeof stockLevels.$inferSelect): StockInfo {
  return {
    variantId: row.variantId,
    available: row.available,
    reserved: row.reserved,
    committed: row.committed,
    onHand: row.available + row.reserved + row.committed,
  }
}

export function createStockService(db: DbClient): StockService {
  async function getRow(variantId: string) {
    return db.query.stockLevels.findFirst({ where: eq(stockLevels.variantId, variantId) })
  }

  return {
    async set(variantId, quantity) {
      if (quantity < 0) throw new Error('Stock quantity cannot be negative')
      const [row] = await db
        .insert(stockLevels)
        .values({ variantId, available: quantity })
        .onConflictDoUpdate({
          target: stockLevels.variantId,
          set: { available: quantity, updatedAt: new Date() },
        })
        .returning()
      if (!row) throw new Error(`Failed to set stock for variant ${variantId}`)
      return toInfo(row)
    },

    async get(variantId) {
      const row = await getRow(variantId)
      return row ? toInfo(row) : null
    },

    async adjust(variantId, delta) {
      const [row] = await db
        .update(stockLevels)
        .set({
          available: sql`GREATEST(0, ${stockLevels.available} + ${delta})`,
          updatedAt: new Date(),
        })
        .where(eq(stockLevels.variantId, variantId))
        .returning()
      if (!row) throw new Error(`No stock entry for variant ${variantId}. Call set() first.`)
      return toInfo(row)
    },

    async isAvailable(variantId, quantity) {
      const row = await getRow(variantId)
      if (!row) return true // no entry = unlimited
      return row.available >= quantity
    },

    async reserve(variantId, quantity) {
      if (quantity <= 0) return
      const result = await db
        .update(stockLevels)
        .set({
          available: sql`${stockLevels.available} - ${quantity}`,
          reserved: sql`${stockLevels.reserved} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(and(eq(stockLevels.variantId, variantId), gte(stockLevels.available, quantity)))
        .returning()

      if (result.length === 0) {
        // Either no entry (unlimited) or not enough available
        const row = await getRow(variantId)
        if (row)
          throw new Error(
            `Insufficient stock for variant ${variantId} (available: ${row.available}, requested: ${quantity})`,
          )
        // No entry = unlimited stock, skip
      }
    },

    async release(variantId, quantity) {
      if (quantity <= 0) return
      await db
        .update(stockLevels)
        .set({
          available: sql`${stockLevels.available} + ${quantity}`,
          reserved: sql`GREATEST(0, ${stockLevels.reserved} - ${quantity})`,
          updatedAt: new Date(),
        })
        .where(eq(stockLevels.variantId, variantId))
    },

    async commit(variantId, quantity) {
      if (quantity <= 0) return
      await db
        .update(stockLevels)
        .set({
          reserved: sql`GREATEST(0, ${stockLevels.reserved} - ${quantity})`,
          committed: sql`${stockLevels.committed} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(stockLevels.variantId, variantId))
    },

    async uncommit(variantId, quantity) {
      if (quantity <= 0) return
      await db
        .update(stockLevels)
        .set({
          committed: sql`GREATEST(0, ${stockLevels.committed} - ${quantity})`,
          available: sql`${stockLevels.available} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(stockLevels.variantId, variantId))
    },
  }
}
