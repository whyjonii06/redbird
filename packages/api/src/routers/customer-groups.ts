import { protectedProcedure, router } from '../trpc.js'

export const customerGroupsRouter = router({
  /** Net payment terms this customer qualifies for, or null if they must pay by card. */
  myPaymentTerms: protectedProcedure.query(async ({ ctx }) => {
    const termsDays = await ctx.redbird.customerGroupsSvc.getPaymentTermsDays(ctx.customerId!)
    return { termsDays }
  }),
})
