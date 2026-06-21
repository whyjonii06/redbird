import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db.js'
import { sendLicenseEmail } from '../email.js'
import { generateId, generateLicenseKey } from '../license-key.js'
import { licenses } from '../schema.js'

export const licensesRouter = new Hono()

// POST /v1/licenses/verify — appelé par les instances Redbird au démarrage
licensesRouter.post('/verify', async (c) => {
  const body = await c.req.json<{ key: string }>()
  if (!body.key) return c.json({ error: 'key required' }, 400)

  const license = await db.query.licenses.findFirst({
    where: eq(licenses.key, body.key),
  })

  if (!license) return c.json({ valid: false, plan: 'free', email: '', expiresAt: null, authorizedPlugins: [] })

  const valid = license.status === 'active' || license.status === 'trialing'
  return c.json({
    valid,
    plan: license.plan,
    email: license.email,
    expiresAt: license.expiresAt ?? null,
    authorizedPlugins: valid ? ['*'] : [],
  })
})

// GET /v1/licenses/:key — consultation (admin ou merchant)
licensesRouter.get('/:key', async (c) => {
  const key = c.req.param('key')
  const adminToken = c.req.header('x-admin-token')
  if (adminToken !== process.env['ADMIN_TOKEN']) return c.json({ error: 'Unauthorized' }, 401)

  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) })
  if (!license) return c.json({ error: 'Not found' }, 404)
  return c.json(license)
})

// POST /v1/licenses/:key/resend-email — renvoyer la clé par email (admin)
licensesRouter.post('/:key/resend-email', async (c) => {
  const adminToken = c.req.header('x-admin-token')
  if (adminToken !== process.env['ADMIN_TOKEN']) return c.json({ error: 'Unauthorized' }, 401)

  const key = c.req.param('key')
  const license = await db.query.licenses.findFirst({ where: eq(licenses.key, key) })
  if (!license) return c.json({ error: 'Not found' }, 404)

  await sendLicenseEmail({ to: license.email, licenseKey: license.key, plan: license.plan })
  return c.json({ ok: true, sentTo: license.email })
})

// POST /v1/licenses — créer une licence manuellement (admin, pour tests)
licensesRouter.post('/', async (c) => {
  const adminToken = c.req.header('x-admin-token')
  if (adminToken !== process.env['ADMIN_TOKEN']) return c.json({ error: 'Unauthorized' }, 401)

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
