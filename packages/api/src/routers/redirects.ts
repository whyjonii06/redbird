import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'

export const redirectsRouter = router({
  /** Look up an active redirect for a path. Returns null if none configured. */
  lookup: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ ctx, input }) => ctx.redbird.redirects.findByPath(input.path)),
})
