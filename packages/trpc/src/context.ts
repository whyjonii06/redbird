import type { Redbird, StaffRole } from '@redbirdshop/core'
import type { RateLimiters } from './rate-limiter.js'

/**
 * Request context shared by the API and by module routers.
 *
 * Lives in this package (rather than the API) so module packages can build
 * their tRPC routers against the exact same typed context without creating a
 * circular dependency on the API.
 */
export type Context = {
  readonly redbird: Redbird
  readonly customerId: string | null
  readonly jwtSecret: string
  readonly isAdmin: boolean
  readonly staffId: string | null
  readonly staffRole: StaffRole | null
  /** Best-effort client IP (from X-Forwarded-For or socket). */
  readonly ip: string
  readonly rateLimiters: RateLimiters
}
