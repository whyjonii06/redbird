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
        paymentMethodId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.paymentMethodId) {
        const methods = await ctx.redbird.paymentMethods.list(ctx.customerId)
        if (!methods.some((m) => m.id === input.paymentMethodId)) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment method not found' })
        }
      }
      return ctx.redbird.subscriptions.create({ ...input, customerId: ctx.customerId })
    }),

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

  /** Attach, switch, or clear (pass null) the saved card charged on renewal. */
  setPaymentMethod: protectedProcedure
    .input(z.object({ id: z.string().uuid(), paymentMethodId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ownedSubscription(ctx, input.id)
      if (input.paymentMethodId) {
        const methods = await ctx.redbird.paymentMethods.list(ctx.customerId)
        if (!methods.some((m) => m.id === input.paymentMethodId)) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment method not found' })
        }
      }
      return ctx.redbird.subscriptions.setPaymentMethod(input.id, input.paymentMethodId)
    }),
})
