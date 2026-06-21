import { definePlugin } from '@redbirdshop/plugin-sdk'
import { sql } from 'drizzle-orm'

// The reviews module owns its data layer (service) and settings; the thin tRPC
// routers live in the API package and call these, so the end-to-end client type
// is preserved (tRPC router types don't survive a package .d.ts boundary).
export {
  listReviews,
  listAllReviews,
  getReview,
  createReview,
  approveReview,
  deleteReview,
  reviewStats,
  type CreateReviewInput,
} from './service.js'
export { readReviewsConfig, REVIEWS_MODULE_NAME, type ReviewsConfig } from './config.js'
export type { ProductReview } from '@redbirdshop/core'

/**
 * Reviews plugin — demonstrates the schema extension pattern.
 *
 * On setup it provisions its own `product_reviews` table (idempotently)
 * and exposes a small CRUD API. On `product.deleted` it cleans up
 * orphan reviews to keep the data consistent.
 *
 * Authors of plugins that need their own data follow this pattern:
 *   1. Define schema as raw SQL or via a Drizzle schema literal
 *   2. Apply in `setup()` with `CREATE TABLE IF NOT EXISTS`
 *   3. Expose typed helpers via `Object.assign(plugin, {...})`
 */

export type Review = {
  readonly id: string
  readonly productId: string
  readonly customerName: string
  readonly rating: number
  readonly comment: string | null
  readonly createdAt: Date
}

type DbAny = {
  execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] } | unknown>
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

function mapReview(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    customerName: row.customer_name as string,
    rating: row.rating as number,
    comment: (row.comment as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  }
}

export function reviews() {
  let db: DbAny | null = null

  async function list(productId: string): Promise<ReadonlyArray<Review>> {
    if (!db) throw new Error('reviews plugin not initialised — call redbird.init()')
    const result = await db.execute(sql`
      SELECT id, product_id, customer_name, rating, comment, created_at
      FROM product_reviews
      WHERE product_id = ${productId}
      ORDER BY created_at DESC
    `)
    return rowsOf(result).map(mapReview)
  }

  async function create(input: {
    productId: string
    customerName: string
    rating: number
    comment?: string | null
  }): Promise<Review> {
    if (!db) throw new Error('reviews plugin not initialised — call redbird.init()')
    if (input.rating < 1 || input.rating > 5) {
      throw new Error(`rating must be 1..5 (got ${input.rating})`)
    }
    const result = await db.execute(sql`
      INSERT INTO product_reviews (product_id, customer_name, rating, comment)
      VALUES (${input.productId}, ${input.customerName}, ${input.rating}, ${input.comment ?? null})
      RETURNING id, product_id, customer_name, rating, comment, created_at
    `)
    const row = rowsOf(result)[0]
    if (!row) throw new Error('Failed to insert review')
    return mapReview(row)
  }

  async function averageRating(productId: string): Promise<{ count: number; average: number }> {
    if (!db) throw new Error('reviews plugin not initialised — call redbird.init()')
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0)::float AS average
      FROM product_reviews
      WHERE product_id = ${productId}
    `)
    const row = rowsOf(result)[0]
    return {
      count: (row?.count as number | undefined) ?? 0,
      average: (row?.average as number | undefined) ?? 0,
    }
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-reviews',
      version: '0.0.0',
      setup: async (ctx) => {
        db = ctx.db as unknown as DbAny
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS product_reviews (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id    UUID NOT NULL,
            customer_name TEXT NOT NULL,
            rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment       TEXT,
            created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `)
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx
          ON product_reviews(product_id)
        `)
      },
      hooks: {
        'product.deleted': async ({ productId }) => {
          if (!db) return
          await db.execute(sql`DELETE FROM product_reviews WHERE product_id = ${productId}`)
        },
      },
    }),
    { list, create, averageRating },
  )
}
