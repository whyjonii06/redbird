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

/**
 * Re-checks a staff JWT against the live staff record on every request:
 * rejects if the account was deleted or deactivated, and rejects a stale
 * token whose embedded tokenVersion no longer matches (bumped on role/active
 * changes). Also swaps in the current DB role, so a demotion takes effect
 * immediately rather than only once the stale token's claims stop being
 * trusted. A JWT alone is static for up to 30 days — without this, revoking
 * or demoting a staff member wouldn't take effect until their token expired.
 * A no-op when the request isn't staff-authenticated (falls through to the
 * master admin key, if any).
 */
const withFreshStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.staffId) return next()
  const member = await ctx.redbird.staff.get(ctx.staffId)
  if (!member || !member.active || member.tokenVersion !== ctx.staffTokenVersion) {
    return next({ ctx: { ...ctx, staffId: null, staffRole: null, staffTokenVersion: null } })
  }
  return next({ ctx: { ...ctx, staffRole: member.role } })
})

/** Any staff member (any role) OR master admin key */
const isStaff = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin && !ctx.staffId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Staff access required' })
  }
  return next()
})

export const staffProcedure = t.procedure.use(withFreshStaff).use(isStaff)

/** Admin/owner staff role OR master admin key */
const isAdmin = t.middleware(({ ctx, next }) => {
  const hasRole = ctx.staffRole === 'owner' || ctx.staffRole === 'admin'
  if (!ctx.isAdmin && !hasRole) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin access required' })
  }
  return next()
})

export const adminProcedure = t.procedure.use(withFreshStaff).use(isAdmin)

/** Owner staff role OR master admin key — for staff management itself */
const isOwner = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin && ctx.staffRole !== 'owner') {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Owner access required' })
  }
  return next()
})

export const ownerProcedure = t.procedure.use(withFreshStaff).use(isOwner)

/** Warehouse staff role or higher OR master admin key */
const isWarehouse = t.middleware(({ ctx, next }) => {
  const roles = ['owner', 'admin', 'warehouse'] as const
  const hasRole = ctx.staffRole ? (roles as readonly string[]).includes(ctx.staffRole) : false
  if (!ctx.isAdmin && !hasRole) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Warehouse access required' })
  }
  return next()
})

export const warehouseProcedure = t.procedure.use(withFreshStaff).use(isWarehouse)

// Rate-limited public procedures — apply to auth, registration, and checkout routes
export const authLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.auth))
export const registerLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.register))
export const checkoutLimitedProcedure = t.procedure.use(rateLimit((rl) => rl.checkout))
