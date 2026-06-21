import { asc, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type ProductFeature, productFeatures } from '../db/schema.js'

export type ProductFeatureInput = {
  name: string
  value: string
  position?: number
}

export type ProductFeatureService = {
  list(productId: string): Promise<ProductFeature[]>
  add(productId: string, input: ProductFeatureInput): Promise<ProductFeature>
  update(id: string, input: Partial<ProductFeatureInput>): Promise<ProductFeature>
  remove(id: string): Promise<void>
}

export function createProductFeatureService(db: DbClient): ProductFeatureService {
  return {
    async list(productId) {
      return db.query.productFeatures.findMany({
        where: eq(productFeatures.productId, productId),
        orderBy: [asc(productFeatures.position), asc(productFeatures.id)],
      })
    },

    async add(productId, { name, value, position = 0 }) {
      const [row] = await db
        .insert(productFeatures)
        .values({ productId, name, value, position })
        .returning()
      if (!row) throw new Error('Failed to add feature')
      return row
    },

    async update(id, patch) {
      const [row] = await db
        .update(productFeatures)
        .set(patch)
        .where(eq(productFeatures.id, id))
        .returning()
      if (!row) throw new Error(`Feature ${id} not found`)
      return row
    },

    async remove(id) {
      await db.delete(productFeatures).where(eq(productFeatures.id, id))
    },
  }
}
