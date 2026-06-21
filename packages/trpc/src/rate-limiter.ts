/**
 * In-memory sliding-window rate limiter. Zero dependencies.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 })
 *   const { allowed, retryAfterMs } = limiter.check(ip)
 */

export type RateLimiter = {
  /** Returns whether the key is allowed through and how long until the window resets. */
  check(key: string): { allowed: boolean; retryAfterMs: number }
}

export type RateLimiters = {
  /** Login, forgot-password, reset-password */
  auth: RateLimiter
  /** Customer & staff registration */
  register: RateLimiter
  /** Order creation, gift-card validation */
  checkout: RateLimiter
}

export const noopLimiter: RateLimiter = {
  check: () => ({ allowed: true, retryAfterMs: 0 }),
}

export const noopRateLimiters: RateLimiters = {
  auth: noopLimiter,
  register: noopLimiter,
  checkout: noopLimiter,
}

export function createRateLimiter(config: { windowMs: number; max: number }): RateLimiter {
  const store = new Map<string, { count: number; resetAt: number }>()

  // Periodically evict stale entries to bound memory usage
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, config.windowMs)
  // Don't keep the process alive for cleanup alone
  if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
    ;(timer as unknown as { unref: () => void }).unref()
  }

  return {
    check(key) {
      const now = Date.now()
      let entry = store.get(key)
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + config.windowMs }
        store.set(key, entry)
      }
      entry.count++
      return {
        allowed: entry.count <= config.max,
        retryAfterMs: Math.max(0, entry.resetAt - now),
      }
    },
  }
}

export function createDefaultRateLimiters(): RateLimiters {
  return {
    // 10 attempts per 15 minutes — brute-force protection on auth routes
    auth: createRateLimiter({ windowMs: 15 * 60_000, max: 10 }),
    // 10 registrations per hour per IP — account-creation spam protection
    register: createRateLimiter({ windowMs: 60 * 60_000, max: 10 }),
    // 30 orders per hour per IP — checkout abuse protection
    checkout: createRateLimiter({ windowMs: 60 * 60_000, max: 30 }),
  }
}
