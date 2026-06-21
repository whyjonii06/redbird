import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type ProductSupplier, type Supplier, productSuppliers, suppliers } from '../db/schema.js'

export type { Supplier, ProductSupplier }

export type CreateSupplierInput = {
  name: string
  contactEmail?: string | undefined
  contactPhone?: string | undefined
  address?: string | undefined
  notes?: string | undefined
}

export type LinkProductInput = {
  supplierSku?: string | undefined
  costPrice?: number | undefined
}

export type SupplierService = {
  list(): Promise<Supplier[]>
  get(id: string): Promise<Supplier | null>
  create(input: CreateSupplierInput): Promise<Supplier>
  update(id: string, patch: Partial<CreateSupplierInput>): Promise<Supplier>
  delete(id: string): Promise<void>
  linkProduct(supplierId: string, productId: string, opts?: LinkProductInput): Promise<ProductSupplier>
  unlinkProduct(supplierId: string, productId: string): Promise<void>
  getProductSuppliers(productId: string): Promise<(ProductSupplier & { supplier: Supplier })[]>
}

export function createSupplierService(db: DbClient): SupplierService {
  return {
    async list() {
      return db.query.suppliers.findMany({ orderBy: (s, { asc }) => [asc(s.name)] })
    },

    async get(id) {
      const row = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id) })
      return row ?? null
    },

    async create(input) {
      const [supplier] = await db
        .insert(suppliers)
        .values({
          name: input.name,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        })
        .returning()
      if (!supplier) throw new Error('Failed to create supplier')
      return supplier
    },

    async update(id, patch) {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.name !== undefined) set['name'] = patch.name
      if (patch.contactEmail !== undefined) set['contactEmail'] = patch.contactEmail
      if (patch.contactPhone !== undefined) set['contactPhone'] = patch.contactPhone
      if (patch.address !== undefined) set['address'] = patch.address
      if (patch.notes !== undefined) set['notes'] = patch.notes

      const [updated] = await db
        .update(suppliers)
        .set(set)
        .where(eq(suppliers.id, id))
        .returning()
      if (!updated) throw new Error(`Supplier ${id} not found`)
      return updated
    },

    async delete(id) {
      await db.delete(suppliers).where(eq(suppliers.id, id))
    },

    async linkProduct(supplierId, productId, opts) {
      const values: Record<string, unknown> = { supplierId, productId }
      if (opts?.supplierSku !== undefined) values['supplierSku'] = opts.supplierSku
      if (opts?.costPrice !== undefined) values['costPrice'] = opts.costPrice

      const [link] = await db
        .insert(productSuppliers)
        .values(values as typeof productSuppliers.$inferInsert)
        .onConflictDoUpdate({
          target: [productSuppliers.productId, productSuppliers.supplierId],
          set: {
            supplierSku: opts?.supplierSku ?? null,
            costPrice: opts?.costPrice ?? null,
          },
        })
        .returning()
      if (!link) throw new Error('Failed to link product to supplier')
      return link
    },

    async unlinkProduct(supplierId, productId) {
      await db
        .delete(productSuppliers)
        .where(
          and(
            eq(productSuppliers.supplierId, supplierId),
            eq(productSuppliers.productId, productId),
          ),
        )
    },

    async getProductSuppliers(productId) {
      const rows = await db.query.productSuppliers.findMany({
        where: eq(productSuppliers.productId, productId),
        with: { supplier: true },
      })
      return rows as (ProductSupplier & { supplier: Supplier })[]
    },
  }
}
