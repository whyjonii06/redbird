import { TRPCError, initTRPC } from '@trpc/server'
import type { Context } from './context.js'
import type { RateLimiter, RateLimiters } from './rate-limiter.js'

const t = initTRPC.context<Context>().create()

// Loopback addresses are never rate-limited — covers local dev and the test suite
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function rateLimit(getLimiter: (rl: RateLimiters) => RateLimiter) {
  return t.middleware(({ ctx, next }) => {
    if (LOOPBACK.has(ctx.ip)) return next()
    const { allowed, retryAfterMs } = getLimiter(ctx.rateLimiters).check(ctx.ip)
    if (!allowed) {
      const secs = Math.ceil(retryAfterMs / 1000)
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many requests. Try again in ${secs}s.`,
      })
    }
    return next()
  })
}

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.customerId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({ ctx: { ...ctx, customerId: ctx.customerId } })
})

export const protectedProcedure = t.procedure.use(isAuthenticated)

/** Any staff member (any role) OR master admin key */
const isStaff = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin && !ctx.staffId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Staff access required' })
  }
  return next()
})

export const staffProcedure = t.procedure.use(isStaff)

/** Admin/owner staff role OR master admin key */
const isAdmin = t.middleware(({ ctx, next }) => {
  const hasRole = ctx.staffRole === 'owner' || ctx.staffRole === 'admin'
  if (!ctx.isAdmin && !hasRole) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin access required' })
  }
  return next()
})

export const adminProcedure = t.procedure.use(isAdmin)

/** Warehouse staff role or higher OR master admin key */
const isWarehouse = t.middleware(({ ctx, next }) => {
  const roles = ['owner', 'admin', 'warehouse'] as const
  const hasRole = ctx.staffRole ? (roles as readonly string[]).includes(ctx.staffRole) : false
  if (!ctx.isAdmin && !hasRole) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Warehouse access required' })
  }
  return next()
})

export const warehouseProcedure = t.procedure.use(isWarehouse)

// Rate-limited public procedures — apply to auth, registration, and checkout routes
export const authLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.auth))
export const registerLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.register))
export const checkoutLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.checkout))
