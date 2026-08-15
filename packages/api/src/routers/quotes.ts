import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc.js'

export const quotesRouter = router({
  /** The current customer's own quote requests. */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['pending', 'quoted', 'accepted', 'rejected', 'expired']).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => ctx.redbird.quotes.list({ customerId: ctx.customerId, ...input })),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const quote = await ctx.redbird.quotes.get(input.id)
      if (!quote || quote.customerId !== ctx.customerId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote request not found' })
      }
      return quote
    }),

  create: protectedProcedure
    .input(
      z.object({
        currency: z.string().length(3),
        items: z
          .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1) }))
          .min(1),
        customerNote: z.string().max(2000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.redbird.quotes.create({ ...input, customerId: ctx.customerId }),
    ),

  /** Accept a quoted request — returns a cart id for the client to send through normal checkout. */
  accept: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.redbird.quotes.accept(input.id, ctx.customerId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not accept quote'
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg })
      }
    }),
})
