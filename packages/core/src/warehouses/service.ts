import { eq, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import type { Address, NewWarehouse, Warehouse } from '../db/schema.js'
import { productVariants, stockLevels, warehouseStock, warehouses } from '../db/schema.js'

export type CreateWarehouseInput = {
  name: string
  code: string
  address?: Address | undefined
  isDefault?: boolean | undefined
}

export type UpdateWarehouseInput = {
  name?: string
  code?: string
  address?: Address | null
  active?: boolean
  isDefault?: boolean
}

export type WarehouseStockRow = {
  warehouseId: string
  warehouseName: string
  quantity: number
}

export type WarehouseService = {
  list(): Promise<Warehouse[]>
  create(input: CreateWarehouseInput): Promise<Warehouse>
  update(id: string, patch: UpdateWarehouseInput): Promise<Warehouse>
  delete(id: string): Promise<void>
  /** Per-warehouse breakdown for one variant, including warehouses with no row yet (quantity 0). */
  stockByVariant(variantId: string): Promise<WarehouseStockRow[]>
  /**
   * Set the physical quantity of a variant in one warehouse, then reconcile
   * stockLevels.available to (sum of all warehouses) − reserved − committed,
   * so the cart reservation pool always reflects real total stock without
   * having to know warehouses exist.
   */
  setStock(warehouseId: string, variantId: string, quantity: number): Promise<void>
}

export function createWarehouseService(db: DbClient): WarehouseService {
  return {
    async list() {
      return db.query.warehouses.findMany({ orderBy: (w, { asc }) => [asc(w.name)] })
    },

    async create(input) {
      if (input.isDefault) {
        await db.update(warehouses).set({ isDefault: false }).where(eq(warehouses.isDefault, true))
      }
      const values: NewWarehouse = { name: input.name, code: input.code.toUpperCase().trim() }
      if (input.address !== undefined) values.address = input.address
      if (input.isDefault !== undefined) values.isDefault = input.isDefault
      const [warehouse] = await db.insert(warehouses).values(values).returning()
      if (!warehouse) throw new Error('Failed to create warehouse')
      return warehouse
    },

    async update(id, patch) {
      if (patch.isDefault) {
        await db.update(warehouses).set({ isDefault: false }).where(eq(warehouses.isDefault, true))
      }
      const setValues: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.name !== undefined) setValues.name = patch.name
      if (patch.code !== undefined) setValues.code = patch.code.toUpperCase().trim()
      if (patch.address !== undefined) setValues.address = patch.address
      if (patch.active !== undefined) setValues.active = patch.active
      if (patch.isDefault !== undefined) setValues.isDefault = patch.isDefault
      const [warehouse] = await db
        .update(warehouses)
        .set(setValues)
        .where(eq(warehouses.id, id))
        .returning()
      if (!warehouse) throw new Error(`Warehouse ${id} not found`)
      return warehouse
    },

    async delete(id) {
      await db.transaction(async (tx) => {
        // Snapshot which variants had stock here before the cascade deletes it,
        // so their aggregate can be reconciled down afterward — otherwise a
        // deleted warehouse's stock would silently linger in `available`.
        const affected = await tx.query.warehouseStock.findMany({
          where: eq(warehouseStock.warehouseId, id),
          columns: { variantId: true },
        })
        const deleted = await tx.delete(warehouses).where(eq(warehouses.id, id)).returning()
        if (deleted.length === 0) throw new Error(`Warehouse ${id} not found`)

        for (const { variantId } of affected) {
          const [totals] = await tx
            .select({ total: sql<number>`COALESCE(SUM(${warehouseStock.quantity}), 0)` })
            .from(warehouseStock)
            .where(eq(warehouseStock.variantId, variantId))
          const totalPhysical = Number(totals?.total ?? 0)

          const existing = await tx.query.stockLevels.findFirst({
            where: eq(stockLevels.variantId, variantId),
          })
          const reserved = existing?.reserved ?? 0
          const committed = existing?.committed ?? 0
          const available = Math.max(0, totalPhysical - reserved - committed)

          await tx
            .insert(stockLevels)
            .values({ variantId, available, reserved, committed })
            .onConflictDoUpdate({
              target: stockLevels.variantId,
              set: { available, updatedAt: new Date() },
            })
        }
      })
    },

    async stockByVariant(variantId) {
      const allWarehouses = await db.query.warehouses.findMany({
        orderBy: (w, { asc }) => [asc(w.name)],
      })
      const rows = await db.query.warehouseStock.findMany({
        where: eq(warehouseStock.variantId, variantId),
      })
      const byWarehouse = new Map(rows.map((r) => [r.warehouseId, r.quantity]))
      return allWarehouses.map((w) => ({
        warehouseId: w.id,
        warehouseName: w.name,
        quantity: byWarehouse.get(w.id) ?? 0,
      }))
    },

    async setStock(warehouseId, variantId, quantity) {
      if (quantity < 0) throw new Error('Stock quantity cannot be negative')

      await db.transaction(async (tx) => {
        const variant = await tx.query.productVariants.findFirst({
          where: eq(productVariants.id, variantId),
        })
        if (!variant) throw new Error(`Variant ${variantId} not found`)

        await tx
          .insert(warehouseStock)
          .values({ warehouseId, variantId, quantity })
          .onConflictDoUpdate({
            target: [warehouseStock.warehouseId, warehouseStock.variantId],
            set: { quantity, updatedAt: new Date() },
          })

        const [totals] = await tx
          .select({ total: sql<number>`COALESCE(SUM(${warehouseStock.quantity}), 0)` })
          .from(warehouseStock)
          .where(eq(warehouseStock.variantId, variantId))
        const totalPhysical = Number(totals?.total ?? 0)

        const existing = await tx.query.stockLevels.findFirst({
          where: eq(stockLevels.variantId, variantId),
        })
        const reserved = existing?.reserved ?? 0
        const committed = existing?.committed ?? 0
        const available = Math.max(0, totalPhysical - reserved - committed)

        await tx
          .insert(stockLevels)
          .values({ variantId, available, reserved, committed })
          .onConflictDoUpdate({
            target: stockLevels.variantId,
            set: { available, updatedAt: new Date() },
          })
      })
    },
  }
}
