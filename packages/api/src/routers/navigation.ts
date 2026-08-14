import { storeSettings } from '@redbirdshop/core/schema'
import { eq } from 'drizzle-orm'
import { publicProcedure, router } from '../trpc.js'
import type { NavItem } from './admin.js'

export const navigationRouter = router({
  /** Public read of the storefront header navigation tree. */
  get: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.redbird.db.query.storeSettings.findFirst({
      where: eq(storeSettings.key, 'header_nav'),
    })
    return (row?.value as NavItem[] | null) ?? []
  }),
})
