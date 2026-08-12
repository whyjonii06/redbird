import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc.js'

export const downloadsRouter = router({
  forOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.redbird.orders.get(input.orderId)
      if (!order || order.customerId !== ctx.customerId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      }
      return ctx.redbird.downloads.getTokensForOrder(input.orderId)
    }),
})
