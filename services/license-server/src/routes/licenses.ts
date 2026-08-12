import { timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db.js'
import { sendLicenseEmail } from '../email.js'
import { generateId, generateLicenseKey } from '../license-key.js'
import { createRateLimiter } from '../rate-limiter.js'
import { licenses } from '../schema.js'

export const licensesRouter = new Hono()

// 20 verifications / minute / IP — generous enough for normal store restarts,
// tight enough to blunt scraping or abuse of this public endpoint.
const verifyLimiter = createRateLimiter({ windowMs: 60_000, max: 20 })
// 10 attempts / 5 minutes / IP on admin-token-gated routes — brute-force protection.
const adminLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 })

function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function isValidAdminToken(provided: string | undefined): boolean {
  const expected = process.env['ADMIN_TOKEN']
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// POST /v1/licenses/verify — appelé par les instances Redbird au démarrage
licensesRouter.post('/verify', async (c) => {
  const { allowed, retryAfterMs } = verifyLimiter.check(clientIp(c))
  if (!allowed) {
    return c.json({ error: 'Too many requests' }, 429, {
      'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
    })
  }

  const body = await c.req.json<{ key: string }>()
  if (!body.key) return c.json({ error: 'key required' }, 400)

  const license = await db.query.licenses.findFirst({
    where: eq(licenses.key, body.key),
  })

  if (!license)
    return c.json({ valid: false, plan: 'free', email: '', expiresAt: null, authorizedPlugins: [] })

  const valid = license.status === 'active' || license.status === 'trialing'
  return c.json({
    valid,
    plan: license.plan,
    email: license.email,
    expiresAt: license.expiresAt ?? null,
    // Only a paid plan actually unlocks paid plugins — status alone doesn't.
    authorizedPlugins: valid && license.plan === 'pro' ? ['*'] : [],
  })
})

// GET /v1/licenses/:key — consultation (admin ou merchant)
licensesRouter.get('/:key', async (c) => {
  const { allowed } = adminLimiter.check(clientIp(c))
  if (!allowed) return c.json({ error: 'Too many requests' }, 429)
  if (!isValidAdminToken(c.req.header('x-admin-token')))
    return c.json({ error: 'Unauthorized' }, 401)

  const key = c.req.param('key')
  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) })
  if (!license) return c.json({ error: 'Not found' }, 404)
  return c.json(license)
})

// POST /v1/licenses/:key/resend-email — renvoyer la clé par email (admin)
licensesRouter.post('/:key/resend-email', async (c) => {
  const { allowed } = adminLimiter.check(clientIp(c))
  if (!allowed) return c.json({ error: 'Too many requests' }, 429)
  if (!isValidAdminToken(c.req.header('x-admin-token')))
    return c.json({ error: 'Unauthorized' }, 401)

  const key = c.req.param('key')
  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) })
  if (!license) return c.json({ error: 'Not found' }, 404)

  await sendLicenseEmail({ to: license.email, licenseKey: license.key, plan: license.plan })
  return c.json({ ok: true, sentTo: license.email })
})

// POST /v1/licenses — créer une licence manuellement (admin, pour tests)
licensesRouter.post('/', async (c) => {
  const { allowed } = adminLimiter.check(clientIp(c))
  if (!allowed) return c.json({ error: 'Too many requests' }, 429)
  if (!isValidAdminToken(c.req.header('x-admin-token')))
    return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ email: string; plan?: 'free' | 'pro'; test?: boolean }>()
  if (!body.email) return c.json({ error: 'email required' }, 400)

  const now = new Date().toISOString()
  const newLicense = {
    id: generateId(),
    key: generateLicenseKey(body.test ?? false),
    email: body.email,
    plan: body.plan ?? ('pro' as const),
    status: 'active' as const,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(licenses).values(newLicense)
  return c.json({ key: newLicense.key, email: newLicense.email, plan: newLicense.plan }, 201)
})
