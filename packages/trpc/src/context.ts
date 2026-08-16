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
  /** Version claim embedded in the staff JWT at sign time — compared against
   * the staff record's current tokenVersion to detect a revoked session. */
  readonly staffTokenVersion: number | null
  /** Marketplace seller — distinct actor type from staff/customer, only ever set from x-seller-token. */
  readonly sellerId: string | null
  /** Resolved tenant for this request (from x-tenant-slug or subdomain) — null means the
   * original single-tenant store, not "no tenant found" (an unknown slug also resolves to null). */
  readonly tenantId: string | null
  /** Best-effort client IP (from X-Forwarded-For or socket). */
  readonly ip: string
  readonly rateLimiters: RateLimiters
}
