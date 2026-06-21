import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'

/**
 * Public storefront API for reviews. The thin router lives here (in the API
 * package) so the end-to-end client type is preserved, while the data layer and
 * settings are owned by the `@redbird/plugin-reviews` module — loaded lazily so
 * the API package can be published/installed without it.
 */
const reviews = () => import('@redbird/plugin-reviews')

export const reviewsRouter = router({
  list: publicProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      (await reviews()).listReviews(ctx.redbird.db, input.productId, { approvedOnly: true }),
    ),

  stats: publicProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => (await reviews()).reviewStats(ctx.redbird.db, input.productId)),

  create: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        customerName: z.string().min(1).max(100),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { readReviewsConfig, createReview } = await reviews()
      const config = readReviewsConfig()
      if (input.rating < config.minRating) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Reviews must be at least ${config.minRating} star${config.minRating > 1 ? 's' : ''}.`,
        })
      }
      return createReview(ctx.redbird.db, {
        productId: input.productId,
        customerId: ctx.customerId ?? undefined,
        customerName: input.customerName,
        rating: input.rating,
        comment: input.comment,
        approved: config.autoApprove,
      })
    }),
})
