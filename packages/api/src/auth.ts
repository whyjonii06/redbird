import { createHmac, timingSafeEqual } from 'node:crypto'
import type { StaffRole } from '@redbirdshop/core'

const EXPIRES_IN = 60 * 60 * 24 * 30 // 30 days

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const HEADER = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))

function sign(payloadObj: object, secret: string): string {
  const payload = base64url(Buffer.from(JSON.stringify(payloadObj)))
  const sig = base64url(createHmac('sha256', secret).update(`${HEADER}.${payload}`).digest())
  return `${HEADER}.${payload}.${sig}`
}

function verify<T>(token: string, secret: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts as [string, string, string]
  const expected = base64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest())
  const expectedBuf = Buffer.from(expected)
  const sigBuf = Buffer.from(sig)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T & { exp?: number }
    if (typeof data.exp === 'number' && Date.now() / 1000 > data.exp) return null
    return data
  } catch {
    return null
  }
}

// ── Customer tokens ──────────────────────────────────────────────────────────

export function signToken(customerId: string, secret: string): string {
  return sign(
    { sub: customerId, type: 'customer', exp: Math.floor(Date.now() / 1000) + EXPIRES_IN },
    secret,
  )
}

export function verifyToken(token: string, secret: string): string | null {
  const data = verify<{ sub?: string; type?: string }>(token, secret)
  if (!data || typeof data.sub !== 'string') return null
  // Accept tokens without type for backwards compat
  if (data.type && data.type !== 'customer') return null
  return data.sub
}

// ── Staff tokens ─────────────────────────────────────────────────────────────

export function signStaffToken(
  staffId: string,
  role: StaffRole,
  tokenVersion: number,
  secret: string,
): string {
  return sign(
    {
      sub: staffId,
      type: 'staff',
      role,
      tv: tokenVersion,
      exp: Math.floor(Date.now() / 1000) + EXPIRES_IN,
    },
    secret,
  )
}

export function verifyStaffToken(
  token: string,
  secret: string,
): { staffId: string; role: StaffRole; tokenVersion: number } | null {
  const data = verify<{ sub?: string; type?: string; role?: string; tv?: number }>(token, secret)
  if (
    !data ||
    data.type !== 'staff' ||
    typeof data.sub !== 'string' ||
    typeof data.role !== 'string'
  )
    return null
  // Tokens signed before this field existed are treated as version 0, matching
  // the column's default — they remain valid until the next role/active change.
  const tokenVersion = typeof data.tv === 'number' ? data.tv : 0
  return { staffId: data.sub, role: data.role as StaffRole, tokenVersion }
}
