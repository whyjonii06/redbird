import { type DbClient, type ProductReview, productReviews } from '@redbirdshop/core'
import { and, avg, count, desc, eq } from 'drizzle-orm'

/**
 * Reviews data layer — owned by the module.
 *
 * The `product_reviews` table stays in the shared core schema (the customer
 * domain also reads it), but all review-specific behaviour lives here. The
 * service operates on the core Drizzle client passed in from the request
 * context (`ctx.redbird.db`), so it shares the same connection and schema.
 */

export type CreateReviewInput = {
  productId: string
  customerId?: string | undefined
  customerName: string
  rating: number
  comment?: string | undefined
  /** When true, the review is published immediately (skips moderation). */
  approved?: boolean | undefined
}

export function listReviews(
  db: DbClient,
  productId: string,
  { approvedOnly = true }: { approvedOnly?: boolean } = {},
): Promise<ProductReview[]> {
  return db.query.productReviews.findMany({
    where: approvedOnly
      ? and(eq(productReviews.productId, productId), eq(productReviews.approved, true))
      : eq(productReviews.productId, productId),
    orderBy: [desc(productReviews.createdAt)],
  })
}

export function listAllReviews(db: DbClient, limit = 100): Promise<ProductReview[]> {
  return db.query.productReviews.findMany({
    orderBy: [desc(productReviews.createdAt)],
    limit,
  })
}

export async function getReview(db: DbClient, id: string): Promise<ProductReview | null> {
  return (await db.query.productReviews.findFirst({ where: eq(productReviews.id, id) })) ?? null
}

export async function createReview(
  db: DbClient,
  { productId, customerId, customerName, rating, comment, approved = false }: CreateReviewInput,
): Promise<ProductReview> {
  if (rating < 1 || rating > 5) throw new Error('rating must be 1..5')
  const [review] = await db
    .insert(productReviews)
    .values({
      productId,
      customerId: customerId ?? null,
      customerName,
      rating,
      comment: comment ?? null,
      approved,
    })
    .returning()
  if (!review) throw new Error('Failed to create review')
  return review
}

export async function approveReview(db: DbClient, id: string): Promise<ProductReview> {
  const [review] = await db
    .update(productReviews)
    .set({ approved: true })
    .where(eq(productReviews.id, id))
    .returning()
  if (!review) throw new Error(`Review ${id} not found`)
  return review
}

export async function deleteReview(db: DbClient, id: string): Promise<void> {
  await db.delete(productReviews).where(eq(productReviews.id, id))
}

export async function reviewStats(
  db: DbClient,
  productId: string,
): Promise<{ count: number; average: number }> {
  const [row] = await db
    .select({ count: count(), average: avg(productReviews.rating) })
    .from(productReviews)
    .where(and(eq(productReviews.productId, productId), eq(productReviews.approved, true)))
  return {
    count: Number(row?.count ?? 0),
    average: Number(row?.average ?? 0),
  }
}
