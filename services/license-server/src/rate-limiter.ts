/** In-memory sliding-window rate limiter. Zero dependencies. */
export type RateLimiter = {
  check(key: string): { allowed: boolean; retryAfterMs: number }
}

export function createRateLimiter(config: { windowMs: number; max: number }): RateLimiter {
  const store = new Map<string, { count: number; resetAt: number }>()

  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, config.windowMs)
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
