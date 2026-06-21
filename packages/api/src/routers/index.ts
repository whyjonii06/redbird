import { router } from '../trpc.js'
import { addressesRouter } from './addresses.js'
import { adminRouter } from './admin.js'
import { attributesRouter } from './attributes.js'
import { cartRouter } from './cart.js'
import { brandsRouter, catalogRouter, categoriesRouter } from './catalog.js'
import { checkoutRouter } from './checkout.js'
import { cmsRouter } from './cms.js'
import { customersRouter } from './customers.js'
import { downloadsRouter } from './downloads.js'
import { loyaltyRouter } from './loyalty.js'
import { returnsRouter } from './returns.js'
import { reviewsRouter } from './reviews.js'
import { staffRouter } from './staff.js'

export const appRouter = router({
  catalog: catalogRouter,
  categories: categoriesRouter,
  brands: brandsRouter,
  cms: cmsRouter,
  cart: cartRouter,
  checkout: checkoutRouter,
  customers: customersRouter,
  addresses: addressesRouter,
  reviews: reviewsRouter,
  returns: returnsRouter,
  staff: staffRouter,
  attributes: attributesRouter,
  downloads: downloadsRouter,
  loyalty: loyaltyRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
