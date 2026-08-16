import type { IncomingMessage } from 'node:http'
import type { Redbird, StaffRole } from '@redbirdshop/core'
import { type Context, type RateLimiters, noopRateLimiters } from '@redbirdshop/trpc'
import { verifySellerToken, verifyStaffToken, verifyToken } from './auth.js'

export type { Context }

/**
 * `X-Forwarded-For` is client-controlled and must only be trusted when the server
 * genuinely sits behind a reverse proxy that overwrites/strips it before forwarding —
 * otherwise any client can spoof a fresh IP on every request and bypass rate limiting.
 * Defaults to false: rate limiting keys off the real TCP peer address, which the client
 * cannot forge.
 */
function extractIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string') {
      const first = xff.split(',')[0]?.trim()
      if (first) return first
    }
  }
  return req.socket.remoteAddress ?? 'unknown'
}

export function createContext(
  redbird: Redbird,
  req: IncomingMessage,
  jwtSecret: string,
  adminKey?: string | undefined,
  rateLimiters?: RateLimiters | undefined,
  trustProxy = false,
): Context {
  const auth = req.headers.authorization
  let customerId: string | null = null
  if (auth?.startsWith('Bearer ')) {
    customerId = verifyToken(auth.slice(7), jwtSecret)
  }

  // Staff auth via x-staff-token header
  const staffTokenHeader = req.headers['x-staff-token']
  const staffTokenStr = typeof staffTokenHeader === 'string' ? staffTokenHeader : undefined
  const staffClaims = staffTokenStr ? verifyStaffToken(staffTokenStr, jwtSecret) : null
  const staffId = staffClaims?.staffId ?? null
  const staffRole: StaffRole | null = staffClaims?.role ?? null
  const staffTokenVersion = staffClaims?.tokenVersion ?? null

  // Seller auth via x-seller-token header
  const sellerTokenHeader = req.headers['x-seller-token']
  const sellerTokenStr = typeof sellerTokenHeader === 'string' ? sellerTokenHeader : undefined
  const sellerId = sellerTokenStr ? verifySellerToken(sellerTokenStr, jwtSecret) : null

  const isAdmin = Boolean(adminKey && req.headers['x-admin-key'] === adminKey)
  const ip = extractIp(req, trustProxy)

  return {
    redbird,
    customerId,
    jwtSecret,
    isAdmin,
    staffId,
    staffRole,
    staffTokenVersion,
    sellerId,
    ip,
    rateLimiters: rateLimiters ?? noopRateLimiters,
  }
}
