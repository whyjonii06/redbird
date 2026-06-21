import {
  approveReview,
  createReview,
  deleteReview,
  getReview,
  listAllReviews,
  listReviews,
  reviewStats,
} from '@redbird/plugin-reviews'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

// Covers the reviews module's data layer (extracted from core into the module
// package; the thin tRPC router in the API calls these functions).
describe('reviews module service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })
  let productId: string

  beforeAll(async () => {
    await rb.init()
  })

  afterAll(async () => {
    await rb.close()
  })

  beforeEach(async () => {
    await rb.db.execute(sql`TRUNCATE TABLE product_reviews RESTART IDENTITY CASCADE`)
    const p = await rb.catalog.createProduct(
      { slug: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: 'P', status: 'active' },
      [],
    )
    productId = p.id
  })

  it('new reviews are unapproved by default and hidden from the public list', async () => {
    await createReview(rb.db, { productId, customerName: 'Jo', rating: 4 })
    expect(await listReviews(rb.db, productId, { approvedOnly: true })).toHaveLength(0)
    expect(await listReviews(rb.db, productId, { approvedOnly: false })).toHaveLength(1)
  })

  it('createReview with approved=true publishes immediately', async () => {
    await createReview(rb.db, { productId, customerName: 'Jo', rating: 5, approved: true })
    const visible = await listReviews(rb.db, productId, { approvedOnly: true })
    expect(visible).toHaveLength(1)
    expect(visible[0]?.approved).toBe(true)
  })

  it('rejects ratings outside 1..5', async () => {
    await expect(createReview(rb.db, { productId, customerName: 'Jo', rating: 6 })).rejects.toThrow()
    await expect(createReview(rb.db, { productId, customerName: 'Jo', rating: 0 })).rejects.toThrow()
  })

  it('stats only count approved reviews and average correctly', async () => {
    await createReview(rb.db, { productId, customerName: 'A', rating: 4, approved: true })
    await createReview(rb.db, { productId, customerName: 'B', rating: 2, approved: true })
    await createReview(rb.db, { productId, customerName: 'C', rating: 5 }) // unapproved
    const stats = await reviewStats(rb.db, productId)
    expect(stats.count).toBe(2)
    expect(stats.average).toBe(3)
  })

  it('approveReview flips the flag and surfaces the review', async () => {
    const r = await createReview(rb.db, { productId, customerName: 'Jo', rating: 3 })
    expect(r.approved).toBe(false)
    const approved = await approveReview(rb.db, r.id)
    expect(approved.approved).toBe(true)
    expect(await listReviews(rb.db, productId, { approvedOnly: true })).toHaveLength(1)
  })

  it('getReview returns the row or null, deleteReview removes it', async () => {
    const r = await createReview(rb.db, { productId, customerName: 'Jo', rating: 3 })
    expect((await getReview(rb.db, r.id))?.id).toBe(r.id)
    await deleteReview(rb.db, r.id)
    expect(await getReview(rb.db, r.id)).toBeNull()
  })

  it('listAllReviews returns every review for moderation (approved or not)', async () => {
    await createReview(rb.db, { productId, customerName: 'A', rating: 4, approved: true })
    await createReview(rb.db, { productId, customerName: 'B', rating: 2 })
    expect(await listAllReviews(rb.db)).toHaveLength(2)
  })
})
