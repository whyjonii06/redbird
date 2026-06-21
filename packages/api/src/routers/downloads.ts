import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'

export const downloadsRouter = router({
  forOrder: publicProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ ctx, input }) => ctx.redbird.downloads.getTokensForOrder(input.orderId)),
})
