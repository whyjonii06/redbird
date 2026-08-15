import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc.js'

export const paymentMethodsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.redbird.paymentMethods.list(ctx.customerId!)
  }),

  /** Starts a save-a-card flow — returns a SetupIntent the client confirms client-side. */
  createSetupIntent: protectedProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.redbird.customers.get(ctx.customerId!)
      if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      try {
        return await ctx.redbird.paymentMethods.createSetupIntent(
          ctx.customerId!,
          customer.email,
          input?.provider,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not start saving a payment method'
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg })
      }
    }),

  /** Persists a payment method after the client confirms its SetupIntent. */
  attach: protectedProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        providerCustomerId: z.string().min(1),
        providerPaymentMethodId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.redbird.paymentMethods.attach(
          ctx.customerId!,
          input.provider,
          input.providerCustomerId,
          input.providerPaymentMethodId,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save payment method'
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg })
      }
    }),

  setDefault: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.redbird.paymentMethods.setDefault(ctx.customerId!, input.id)
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not update payment method'
        throw new TRPCError({ code: 'NOT_FOUND', message: msg })
      }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.redbird.paymentMethods.remove(ctx.customerId!, input.id)
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not remove payment method'
        throw new TRPCError({ code: 'NOT_FOUND', message: msg })
      }
    }),
})
