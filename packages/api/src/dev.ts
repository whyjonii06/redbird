import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRedbird } from '@redbirdshop/core'
import { createApiServer } from './server.js'

// Derive monorepo root from this file's location (packages/api/src → ../../..)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Load .env if it exists (Node 22 built-in)
try {
  process.loadEnvFile(resolve(ROOT, '.env'))
} catch {
  // .env not present yet — fine on first run
}

// Config lives inside packages/api so @redbird/* imports resolve correctly via pnpm workspace
const CONFIG_PATH = resolve(ROOT, 'packages', 'api', 'redbird.config.ts')
const ENV_PATH = resolve(ROOT, '.env')
const META_PATH = resolve(ROOT, 'redbird.meta.json')
const isConfigured = existsSync(CONFIG_PATH)

// Maps an installed plugin's package name to the named export of its factory.
// Declared here (top of module) so it is initialised before the normal-mode
// bootstrap below awaits loadInstalledPlugins() — otherwise accessing it from
// that top-level await hits the temporal dead zone.
const PLUGIN_FACTORY_MAP: Record<string, string> = {
  '@redbird/plugin-email-local': 'local',
  '@redbird/plugin-stripe': 'stripe',
  '@redbird/plugin-paypal': 'paypal',
  '@redbird/plugin-email-resend': 'resend',
  '@redbird/plugin-email-smtp': 'smtp',
  '@redbird/plugin-shipping-flat': 'shippingFlat',
  '@redbird/plugin-shipping-zones': 'shippingZones',
  '@redbird/plugin-shipping-mondial-relay': 'shippingMondialRelay',
  '@redbird/plugin-tax-rules': 'taxRules',
  '@redbird/plugin-vat-eu': 'vatEu',
  '@redbird/plugin-reviews': 'reviews',
  '@redbird/plugin-analytics': 'analytics',
}

// ─── Types ──────────────────────────────────────────────────────────────────

type SetupPayload = {
  storeName: string
  currency: string
  adminKey: string
  theme: string
  branding: {
    logoUrl?: string
    tagline?: string
    contactEmail?: string
    primaryColor: string
  }
  modules: {
    stripe?: { enabled: boolean; secretKey: string; webhookSecret: string }
    paypal?: { enabled: boolean; clientId: string; clientSecret: string }
    resend?: { enabled: boolean; apiKey: string; from: string }
    smtp?: {
      enabled: boolean
      host: string
      port: number
      user: string
      password: string
      from: string
    }
    flatShipping?: { enabled: boolean }
    vatEu?: { enabled: boolean; homeCountry: string }
    reviews?: { enabled: boolean }
    analytics?: { enabled: boolean; provider: string; siteId: string }
  }
  seedData?: boolean
}

// ─── File generators ────────────────────────────────────────────────────────

function buildEnv(p: SetupPayload, jwtSecret: string): string {
  const lines = [
    `ADMIN_KEY=${p.adminKey}`,
    `JWT_SECRET=${jwtSecret}`,
    `DEFAULT_CURRENCY=${p.currency}`,
  ]
  if (p.modules.stripe?.enabled) {
    lines.push(`STRIPE_SECRET_KEY=${p.modules.stripe.secretKey}`)
    lines.push(`STRIPE_WEBHOOK_SECRET=${p.modules.stripe.webhookSecret}`)
  }
  if (p.modules.paypal?.enabled) {
    lines.push(`PAYPAL_CLIENT_ID=${p.modules.paypal.clientId}`)
    lines.push(`PAYPAL_CLIENT_SECRET=${p.modules.paypal.clientSecret}`)
  }
  if (p.modules.resend?.enabled) {
    lines.push(`RESEND_API_KEY=${p.modules.resend.apiKey}`)
    lines.push(`RESEND_FROM=${p.modules.resend.from}`)
  }
  if (p.modules.smtp?.enabled) {
    lines.push(`SMTP_HOST=${p.modules.smtp.host}`)
    lines.push(`SMTP_PORT=${p.modules.smtp.port}`)
    lines.push(`SMTP_USER=${p.modules.smtp.user}`)
    lines.push(`SMTP_PASS=${p.modules.smtp.password}`)
    lines.push(`SMTP_FROM=${p.modules.smtp.from}`)
  }
  if (p.modules.vatEu?.enabled) {
    lines.push(`VAT_HOME_COUNTRY=${p.modules.vatEu.homeCountry}`)
  }
  if (p.modules.analytics?.enabled) {
    lines.push(`ANALYTICS_PROVIDER=${p.modules.analytics.provider}`)
    lines.push(`ANALYTICS_SITE_ID=${p.modules.analytics.siteId}`)
  }
  return `${lines.join('\n')}\n`
}

function buildConfig(p: SetupPayload): string {
  const m = p.modules
  const imports: string[] = ["import { defineConfig } from '@redbirdshop/core'"]
  const plugins: string[] = []
  let defaultPayment = ''
  let defaultEmail = ''

  if (m.stripe?.enabled) {
    imports.push("import { stripe } from '@redbird/plugin-stripe'")
    plugins.push(
      '    stripe({ secretKey: process.env.STRIPE_SECRET_KEY!, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET! }),',
    )
    if (!defaultPayment) defaultPayment = 'stripe'
  }
  if (m.paypal?.enabled) {
    imports.push("import { paypal } from '@redbird/plugin-paypal'")
    plugins.push(
      '    paypal({ clientId: process.env.PAYPAL_CLIENT_ID!, clientSecret: process.env.PAYPAL_CLIENT_SECRET! }),',
    )
    if (!defaultPayment) defaultPayment = 'paypal'
  }
  if (m.resend?.enabled) {
    imports.push("import { resend } from '@redbird/plugin-email-resend'")
    plugins.push(
      '    resend({ apiKey: process.env.RESEND_API_KEY!, from: process.env.RESEND_FROM! }),',
    )
    if (!defaultEmail) defaultEmail = 'resend'
  }
  if (m.smtp?.enabled) {
    imports.push("import { smtp } from '@redbird/plugin-email-smtp'")
    plugins.push(
      '    smtp({ host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT), user: process.env.SMTP_USER!, password: process.env.SMTP_PASS!, from: process.env.SMTP_FROM! }),',
    )
    if (!defaultEmail) defaultEmail = 'smtp'
  }
  if (m.flatShipping?.enabled) {
    imports.push("import { shippingFlat } from '@redbird/plugin-shipping-flat'")
    plugins.push(`    shippingFlat({ zones: [{ name: 'Default', countries: [], rateAmount: 0, rateCurrency: ${JSON.stringify(p.currency)} }] }),`)
  }
  if (m.vatEu?.enabled) {
    imports.push("import { vatEu } from '@redbird/plugin-vat-eu'")
    plugins.push('    vatEu({ homeCountry: process.env.VAT_HOME_COUNTRY! }),')
  }
  if (m.reviews?.enabled) {
    imports.push("import { reviews } from '@redbird/plugin-reviews'")
    plugins.push('    reviews(),')
  }
  if (m.analytics?.enabled) {
    imports.push("import { analytics } from '@redbird/plugin-analytics'")
    plugins.push(
      `    analytics({ provider: process.env.ANALYTICS_PROVIDER as 'console', siteId: process.env.ANALYTICS_SITE_ID }),`,
    )
  }

  const config = [
    `  storeName: ${JSON.stringify(p.storeName)},`,
    `  defaultCurrency: ${JSON.stringify(p.currency)},`,
    plugins.length > 0 ? `  plugins: [\n${plugins.join('\n')}\n  ],` : '  plugins: [],',
    ...(defaultPayment ? [`  defaultPaymentProvider: ${JSON.stringify(defaultPayment)},`] : []),
    ...(defaultEmail ? [`  defaultEmailProvider: ${JSON.stringify(defaultEmail)},`] : []),
  ]

  return `${imports.join('\n')}\n\nexport default defineConfig({\n${config.join('\n')}\n})\n`
}

// ─── Setup mode ─────────────────────────────────────────────────────────────

if (!isConfigured) {
  console.log('\n  Redbird — first-run setup')
  console.log('  Open http://localhost:3004 to configure your store\n')

  const setupServer = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url ?? ''

    if (url === '/setup/status' && req.method === 'GET') {
      json(res, { configured: false })
      return
    }

    if (url === '/setup' && req.method === 'POST') {
      readBody(req)
        .then(async (raw) => {
          const payload = raw as SetupPayload
          const jwtSecret = randomBytes(32).toString('hex')

          writeFileSync(ENV_PATH, buildEnv(payload, jwtSecret))
          writeFileSync(
            META_PATH,
            JSON.stringify({ branding: payload.branding, theme: payload.theme }, null, 2),
          )
          writeFileSync(CONFIG_PATH, buildConfig(payload))

          // Load newly written env vars into process.env
          try { process.loadEnvFile(ENV_PATH) } catch {}

          json(res, { ok: true })

          // Force-close all connections so setupServer.close() callback fires immediately
          setTimeout(() => setupServer.closeAllConnections?.(), 150)

          // Close setup server then boot the real API in the same process.
          // We build the config from the payload directly — importing redbird.config.ts
          // from the monorepo root would fail because @redbird/* packages aren't
          // resolvable from there via ESM. The written file is used on cold restarts only.
          setupServer.close(async () => {
            try {
              const m = payload.modules
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const plugins: any[] = []

              if (m.stripe?.enabled) {
                const { stripe } = await import('@redbird/plugin-stripe')
                plugins.push(stripe({ secretKey: process.env.STRIPE_SECRET_KEY!, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET! }))
              }
              if (m.paypal?.enabled) {
                const { paypal } = await import('@redbird/plugin-paypal')
                plugins.push(paypal({ clientId: process.env.PAYPAL_CLIENT_ID!, clientSecret: process.env.PAYPAL_CLIENT_SECRET! }))
              }
              if (m.resend?.enabled) {
                const { resend } = await import('@redbird/plugin-email-resend')
                plugins.push(resend({ apiKey: process.env.RESEND_API_KEY!, from: process.env.RESEND_FROM! }))
              }
              if (m.smtp?.enabled) {
                const { smtp } = await import('@redbird/plugin-email-smtp')
                plugins.push(smtp({ host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT), user: process.env.SMTP_USER!, password: process.env.SMTP_PASS!, from: process.env.SMTP_FROM! }))
              }
              if (m.flatShipping?.enabled) {
                const { shippingFlat } = await import('@redbird/plugin-shipping-flat')
                plugins.push(shippingFlat({ zones: [{ name: 'Default', countries: [], rateAmount: 0, rateCurrency: payload.currency }] }))
              }
              if (m.vatEu?.enabled) {
                const { vatEu } = await import('@redbird/plugin-vat-eu')
                plugins.push(vatEu({ homeCountry: process.env.VAT_HOME_COUNTRY! }))
              }
              if (m.reviews?.enabled) {
                const { reviews } = await import('@redbird/plugin-reviews')
                plugins.push(reviews())
              }
              if (m.analytics?.enabled) {
                const { analytics } = await import('@redbird/plugin-analytics')
                plugins.push(analytics({ provider: process.env.ANALYTICS_PROVIDER as 'console', siteId: process.env.ANALYTICS_SITE_ID }))
              }

              const redbird = createRedbird({
                storeName: payload.storeName,
                defaultCurrency: payload.currency,
                ...(process.env.DATABASE_URL ? { databaseUrl: process.env.DATABASE_URL } : {}),
                plugins,
              })
              await redbird.init()

              if (payload.seedData) {
                const { seedDemoData } = await import('./seed.js')
                await seedDemoData(redbird, payload.currency)
              }

              const adminKey = process.env.ADMIN_KEY ?? payload.adminKey
              const server = createApiServer({
                redbird,
                port: Number(process.env.PORT ?? 3000),
                adminKey,
                jwtSecret: process.env.JWT_SECRET ?? jwtSecret,
              })
              await server.listen()
              console.log(`\n  Store "${payload.storeName}" is live!`)
              console.log(`  API → http://localhost:${server.port}`)
              console.log('  Admin → http://localhost:3004\n')
            } catch (err) {
              console.error('Failed to boot store after setup:', err)
            }
          })
        })
        .catch((err) => {
          res.writeHead(400)
          res.end(JSON.stringify({ error: String(err) }))
        })
      return
    }

    res.writeHead(404)
    res.end()
  })

  setupServer.listen(3000)

  // ─── Normal mode ────────────────────────────────────────────────────────────
} else {
  const { default: storeConfig } = (await import(pathToFileURL(CONFIG_PATH).href)) as {
    default: import('@redbirdshop/core').RedbirdConfig
  }

  const redbird = createRedbird({
    ...storeConfig,
    ...(process.env.DATABASE_URL ? { databaseUrl: process.env.DATABASE_URL } : {}),
    defaultCurrency: storeConfig.defaultCurrency ?? process.env.DEFAULT_CURRENCY ?? 'EUR',
    ...(process.env.REDBIRD_LICENSE_SERVER_URL ? { licenseServerUrl: process.env.REDBIRD_LICENSE_SERVER_URL } : {}),
  })

  await redbird.init()

  // Load plugins installed after initial setup (persisted in meta.json)
  await loadInstalledPlugins(redbird)

  const adminKey = process.env.ADMIN_KEY ?? 'dev-admin-key'

  const server = createApiServer({
    redbird,
    port: Number(process.env.PORT ?? 3000),
    adminKey,
    jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret',
  })

  await server.listen()

  const name = storeConfig.storeName ? `"${storeConfig.storeName}"` : 'store'
  console.log(`\n  ${name} is running`)
  console.log(`  API   → http://localhost:${server.port}${server.basePath}`)
  console.log('  Admin → http://localhost:3004')
  console.log(`  Key   → ${adminKey}\n`)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadInstalledPlugins(redbird: import('@redbirdshop/core').Redbird): Promise<void> {
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(readFileSync(META_PATH, 'utf8')) } catch { return }
  const installed = (meta.installedPlugins ?? []) as Array<{ name: string; config: Record<string, unknown> }>
  for (const entry of installed) {
    if (redbird.plugins.list().some((p) => p.name === entry.name)) continue
    const factoryName = PLUGIN_FACTORY_MAP[entry.name]
    if (!factoryName) continue
    try {
      const mod = (await import(entry.name)) as Record<string, unknown>
      const factory = mod[factoryName]
      if (typeof factory !== 'function') continue
      let cfg = entry.config ?? {}
      if (entry.name === '@redbird/plugin-email-smtp' && typeof cfg.port === 'string') {
        cfg = { ...cfg, port: Number(cfg.port) }
      }
      const plugin = (factory as (c: unknown) => unknown)(cfg)
      redbird.installPlugin(plugin)
      console.log(`  ✓ plugin ${entry.name}`)
    } catch (e) {
      console.warn(`  ⚠ could not load plugin ${entry.name}: ${e}`)
    }
  }
}

function json(res: ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
