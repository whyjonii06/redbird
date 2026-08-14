import { publicProcedure, router } from '../trpc.js'

export const currencyRouter = router({
  /** Supported currencies + their rate relative to the store's default currency. */
  list: publicProcedure.query(async ({ ctx }) => ctx.redbird.currency.getConfig()),
})
