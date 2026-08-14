import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Context } from '../trpc.js'
import { protectedProcedure, router } from '../trpc.js'

async function ownedSubscription(ctx: Context, id: string) {
  const sub = await ctx.redbird.subscriptions.get(id)
  if (!sub || sub.customerId !== ctx.customerId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' })
  }
  return sub
}

export const subscriptionsRouter = router({
  /** The current customer's own subscriptions. */
  list: protectedProcedure.query(({ ctx }) => ctx.redbird.subscriptions.list(ctx.customerId)),

  create: protectedProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20).default(1),
        interval: z.enum(['weekly', 'monthly', 'yearly']),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.redbird.subscriptions.create({ ...input, customerId: ctx.customerId }),
    ),

  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ownedSubscription(ctx, input.id)
      return ctx.redbird.subscriptions.pause(input.id)
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ownedSubscription(ctx, input.id)
      return ctx.redbird.subscriptions.resume(input.id)
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ownedSubscription(ctx, input.id)
      return ctx.redbird.subscriptions.cancel(input.id)
    }),
})
