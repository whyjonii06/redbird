import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile as readFilePromise } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Redbird, SellerConfig } from '@redbirdshop/core'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import sharp from 'sharp'
import { verifyStaffToken } from './auth.js'
import { createContext } from './context.js'
import { generateFacturXForOrder, generateFacturXPdf, generateInvoicePdf } from './invoice.js'
import { type Logger, createLogger } from './logger.js'
import { createDefaultRateLimiters, createRateLimiter } from './rate-limiter.js'
import { handleRestRequest } from './rest.js'
import { appRouter } from './routers/index.js'
import { buildWebhookHandlerMap, handleWebhookRequest } from './webhooks.js'

// Resolved from this file's own location rather than process.cwd() — pnpm's
// `--filter <pkg> <script>` (used by the documented `pnpm dev`) runs with cwd
// set to that package's directory, not the repo root, so a cwd-relative path
// here would silently miss the repo-root redbird.meta.json that admin.ts
// writes branding/seller/theme-ownership edits to (same bug fixed in
// routers/admin.ts — see the comment there for the full story).
const META_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', 'redbird.meta.json')

/** Resolve the seller legal identity from the BO-edited meta.json, falling back to config. */
function resolveSeller(redbird: Redbird): SellerConfig | undefined {
  try {
    const meta = JSON.parse(readFileSync(META_PATH, 'utf8')) as {
      seller?: SellerConfig
    }
    if (meta?.seller) return meta.seller
  } catch {}
  return redbird.config.seller
}

export type ServerOptions = {
  readonly redbird: Redbird
  readonly port?: number
  readonly basePath?: string
  /** Secret used to sign and verify JWT tokens. Required for auth to work. */
  readonly jwtSecret?: string
  /** Secret key required in x-admin-key header to access admin procedures. */
  readonly adminKey?: string | undefined
  /**
   * Trust the `X-Forwarded-For` header for rate-limiting/IP logging. Only enable this when
   * the server sits behind a reverse proxy that overwrites the header (nginx, Cloudflare...) —
   * otherwise clients can spoof it to bypass rate limiting. Defaults to false.
   */
  readonly trustProxy?: boolean
  /** Abandoned cart recovery: run every N minutes (default: disabled). Set to 0 to disable. */
  readonly abandonedCartIntervalMinutes?: number
  /** Subscription renewal reminders: run every N minutes (default: disabled). Set to 0 to disable. */
  readonly subscriptionReminderIntervalMinutes?: number
  /** Store URL for abandoned cart recovery emails (e.g. https://mystore.com). */
  readonly storeUrl?: string
  /** Public storefront base URL — used in sitemap.xml (e.g. https://mystore.com). */
  readonly storefrontUrl?: string
  /**
   * Custom logger. Defaults to pino (pretty in dev, JSON in prod, silent in test).
   * Pass `false` to disable all logging.
   */
  readonly logger?: Logger | false
}

// tRPC error codes that are normal client behaviour — log at warn, not error
const CLIENT_ERROR_CODES = new Set([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'PRECONDITION_FAILED',
])

export function createApiServer(opts: ServerOptions) {
  const jwtSecret = opts.jwtSecret ?? ''
  const rateLimiters = createDefaultRateLimiters()
  // Separate limiter for image uploads: 20 uploads / minute per IP
  const uploadLimiter = createRateLimiter({ windowMs: 60_000, max: 20 })

  const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

  const log: Logger | false = opts.logger !== undefined ? opts.logger : createLogger()

  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: ({ req }) =>
      createContext(opts.redbird, req, jwtSecret, opts.adminKey, rateLimiters, opts.trustProxy),
    onError: ({ path, error, req }) => {
      if (!log) return
      const ip = req.socket.remoteAddress ?? 'unknown'
      if (CLIENT_ERROR_CODES.has(error.code)) {
        log.warn({ path, code: error.code, message: error.message, ip }, 'trpc client error')
      } else {
        log.error(
          { path, code: error.code, message: error.message, ip, err: error.cause },
          'trpc error',
        )
      }
    },
  })

  // SSE clients
  const sseClients = new Set<import('node:http').ServerResponse>()

  // Push plugin events to all connected SSE clients
  opts.redbird.plugins.onEmit((name, ctx) => {
    if (sseClients.size === 0) return
    const payload: Record<string, unknown> = { type: name }
    if (name === 'order.created') {
      const order = (
        ctx as {
          order?: {
            id: string
            number: number
            totalAmount: number
            currency: string
            customerEmail: string
          }
        }
      ).order
      if (order) {
        payload.orderId = order.id
        payload.orderNumber = order.number
        payload.total = order.totalAmount
        payload.currency = order.currency
      }
    } else if (name === 'order.paid') {
      const order = (ctx as { order?: { id: string; number: number } }).order
      if (order) {
        payload.orderId = order.id
        payload.orderNumber = order.number
      }
    }
    const data = JSON.stringify(payload)
    for (const client of [...sseClients]) {
      try {
        client.write(`data: ${data}\n\n`)
      } catch {
        sseClients.delete(client)
      }
    }
  })

  const basePath = opts.basePath ?? '/trpc'
  const requestedPort = opts.port ?? 3000
  const webhookHandlers = buildWebhookHandlerMap(opts.redbird)

  const storeName = opts.redbird.config.storeName ?? ''

  const uploadDir = resolve(process.cwd(), 'uploads')

  const IMAGE_MIME: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
  }

  const server = createServer((req, res) => {
    const url = req.url ?? ''
    const startMs = Date.now()

    // Log each completed HTTP request (skip OPTIONS preflights)
    if (req.method !== 'OPTIONS' && log) {
      res.on('finish', () => {
        const ms = Date.now() - startMs
        const ip = req.socket.remoteAddress ?? 'unknown'
        const path = url.split('?')[0]
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
        log[level]({ method: req.method, path, status: res.statusCode, ms, ip }, 'http')
      })
    }

    // ── Health check ─────────────────────────────────────────────────────────
    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'redbird-api' }))
      return
    }

    // ── Static file serving for uploaded images, with optional on-the-fly
    // resize/format conversion via ?w=<px>&fmt=webp|avif|jpeg|png. Derived
    // variants are cached to disk on first request so repeat hits (and other
    // visitors requesting the same size) are a plain file read. ────────────
    if (url.startsWith('/uploads/') && req.method === 'GET') {
      const parsed = new URL(url, 'http://internal')
      const filename = parsed.pathname.slice('/uploads/'.length)
      if (!filename || filename.includes('/') || filename.includes('..')) {
        res.writeHead(400)
        res.end()
        return
      }
      const filepath = join(uploadDir, filename)
      const origExt = filename.split('.').pop()?.toLowerCase() ?? ''
      const TRANSFORM_FORMATS = new Set(['webp', 'avif', 'jpeg', 'jpg', 'png'])
      const wParam = parsed.searchParams.get('w')
      const fmtParam = parsed.searchParams.get('fmt')
      const width = wParam !== null ? Number.parseInt(wParam, 10) : null
      const format = fmtParam && TRANSFORM_FORMATS.has(fmtParam) ? fmtParam : null

      const wantsTransform = wParam !== null || format !== null

      if (!wantsTransform) {
        try {
          const content = readFileSync(filepath)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          res.writeHead(200, { 'Content-Type': IMAGE_MIME[origExt] ?? 'application/octet-stream' })
          res.end(content)
        } catch {
          res.writeHead(404)
          res.end()
        }
        return
      }

      if (width !== null && (!Number.isInteger(width) || width < 16 || width > 2000)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'w must be an integer between 16 and 2000' }))
        return
      }

      const outFormat = format ?? (origExt === 'png' ? 'png' : 'webp')
      const cacheDir = join(uploadDir, '.cache')
      const cacheName = `${filename.replace(/\.[^.]+$/, '')}-${width ?? 'orig'}.${outFormat}`
      const cachePath = join(cacheDir, cacheName)

      const serve = (buf: Buffer) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.writeHead(200, { 'Content-Type': IMAGE_MIME[outFormat] ?? 'application/octet-stream' })
        res.end(buf)
      }

      try {
        serve(readFileSync(cachePath))
        return
      } catch {
        // Not cached yet — fall through to generate it.
      }

      readFilePromise(filepath)
        .then(async (original) => {
          let pipeline = sharp(original).rotate()
          if (width !== null) pipeline = pipeline.resize({ width, withoutEnlargement: true })
          if (outFormat === 'webp') pipeline = pipeline.webp({ quality: 82 })
          else if (outFormat === 'avif') pipeline = pipeline.avif({ quality: 60 })
          else if (outFormat === 'png') pipeline = pipeline.png()
          else pipeline = pipeline.jpeg({ quality: 85 })

          const out = await pipeline.toBuffer()
          mkdirSync(cacheDir, { recursive: true })
          writeFileSync(cachePath, out)
          serve(out)
        })
        .catch(() => {
          res.writeHead(404)
          res.end()
        })
      return
    }

    // Download a sellable storefront theme as a self-contained .zip.
    // Free themes are open; paid ones require ownership (meta.json ownedThemes).
    if (url.startsWith('/themes/') && url.endsWith('/download') && req.method === 'GET') {
      const id = url.slice('/themes/'.length, url.length - '/download'.length)
      if (!/^[a-z0-9-]+$/.test(id)) {
        res.writeHead(400)
        res.end()
        return
      }
      const FREE_THEMES = new Set(['classic'])
      let owned: string[] = []
      try {
        const meta = JSON.parse(readFileSync(META_PATH, 'utf8')) as { ownedThemes?: string[] }
        owned = meta.ownedThemes ?? []
      } catch {}
      if (!FREE_THEMES.has(id) && !owned.includes(id)) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Purchase this theme to download it.' }))
        return
      }
      try {
        const zip = readFileSync(resolve(process.cwd(), 'packages/api/themes', `${id}.zip`))
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="redbird-storefront-${id}.zip"`,
          'Content-Length': zip.length,
        })
        res.end(zip)
      } catch {
        res.writeHead(404)
        res.end()
      }
      return
    }

    // ── Image upload (base64 JSON) ────────────────────────────────────────────
    if (url === '/uploads' && req.method === 'POST') {
      // Mirrors admin.images.add's adminProcedure: master admin key, or staff with
      // owner/admin role. This raw HTTP endpoint bypasses tRPC, so it must check itself.
      const staffTokenHeader = req.headers['x-staff-token']
      const staffToken = typeof staffTokenHeader === 'string' ? staffTokenHeader : undefined
      const staffClaims = staffToken ? verifyStaffToken(staffToken, jwtSecret) : null
      const hasAdminKey = Boolean(opts.adminKey && req.headers['x-admin-key'] === opts.adminKey)
      const hasStaffRole = staffClaims?.role === 'owner' || staffClaims?.role === 'admin'
      if (!hasAdminKey && !hasStaffRole) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Admin access required' }))
        return
      }

      const uploaderIp = req.socket.remoteAddress ?? 'unknown'
      if (!LOOPBACK.has(uploaderIp)) {
        const { allowed } = uploadLimiter.check(uploaderIp)
        if (!allowed) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Too many uploads. Try again later.' }))
          return
        }
      }
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          const { filename, data } = JSON.parse(body) as { filename: string; data: string }
          if (!filename || !data) throw new Error('filename and data required')
          const base64 = data.replace(/^data:[^;]+;base64,/, '')
          const buffer = Buffer.from(base64, 'base64')
          const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
          if (!IMAGE_MIME[ext]) throw new Error('Unsupported file type')
          mkdirSync(uploadDir, { recursive: true })
          const safe = `${randomUUID()}.${ext}`
          writeFileSync(join(uploadDir, safe), buffer)
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ url: `/uploads/${safe}` }))
        } catch (err) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }))
        }
      })
      return
    }

    // ── CORS preflight for uploads ────────────────────────────────────────────
    if (url === '/uploads' && req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.writeHead(204)
      res.end()
      return
    }

    // ── PDF invoice ───────────────────────────────────────────────────────────
    // Relay-point search — delegated to the active shipping provider that
    // supports it (e.g. the Mondial Relay plugin, installed via the Marketplace).
    if (url.startsWith('/shipping/relay-points') && req.method === 'GET') {
      const q = new URL(url, 'http://localhost').searchParams
      const postalCode = q.get('zip') ?? q.get('postalCode') ?? ''
      const countryCode = (q.get('country') ?? 'FR').toUpperCase()
      const count = Math.min(30, Math.max(1, Number(q.get('count') ?? 10)))
      const provider = opts.redbird.shipping
        .all()
        .find((p) => typeof p.searchRelayPoints === 'function')
      if (!provider?.searchRelayPoints) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error:
              'No relay-point provider installed. Add the Mondial Relay plugin from the Marketplace.',
          }),
        )
        return
      }
      if (!postalCode) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing `zip` query parameter.' }))
        return
      }
      provider
        .searchRelayPoints({ countryCode, postalCode, count })
        .then((points) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ points }))
        })
        .catch((err) => {
          if (log) log.warn({ err: String(err) }, 'relay point search failed')
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Relay point search failed.' }))
        })
      return
    }

    // Factur-X hybrid PDF/A-3 (visual PDF + embedded CII XML) for an order.
    if (url.startsWith('/invoices/') && url.endsWith('/factur-x.pdf') && req.method === 'GET') {
      const orderId = url.slice('/invoices/'.length, -'/factur-x.pdf'.length)
      ;(async () => {
        const seller = resolveSeller(opts.redbird)
        if (!seller) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error:
                'Seller legal identity not configured. Set `seller` in your Redbird config to issue Factur-X invoices.',
            }),
          )
          return
        }
        const order = await opts.redbird.orders.get(orderId)
        if (!order) {
          res.writeHead(404)
          res.end()
          return
        }
        const { number: invoiceNumber } = await opts.redbird.orders.issueInvoice(order.id)
        const refreshed = (await opts.redbird.orders.get(orderId)) ?? order
        const pdf = await generateFacturXPdf(refreshed, seller, invoiceNumber, storeName)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Disposition', `attachment; filename="factur-x-${invoiceNumber}.pdf"`)
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length })
        res.end(pdf)
      })().catch((err) => {
        if (log) log.error({ orderId, err }, 'factur-x pdf generation failed')
        if (!res.headersSent) {
          res.writeHead(500)
          res.end()
        }
      })
      return
    }

    // Factur-X (CII / EN 16931) XML payload for an order — the structured e-invoice.
    if (url.startsWith('/invoices/') && url.endsWith('/factur-x.xml') && req.method === 'GET') {
      const orderId = url.slice('/invoices/'.length, -'/factur-x.xml'.length)
      ;(async () => {
        const seller = resolveSeller(opts.redbird)
        if (!seller) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error:
                'Seller legal identity not configured. Set `seller` in your Redbird config to issue Factur-X invoices.',
            }),
          )
          return
        }
        const order = await opts.redbird.orders.get(orderId)
        if (!order) {
          res.writeHead(404)
          res.end()
          return
        }
        // Assign (or reuse) the sequential, gapless legal invoice number.
        const { number: invoiceNumber } = await opts.redbird.orders.issueInvoice(order.id)
        const xml = generateFacturXForOrder(order, seller, invoiceNumber)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Disposition', `attachment; filename="factur-x-${invoiceNumber}.xml"`)
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' })
        res.end(xml)
      })().catch((err) => {
        if (log) log.error({ orderId, err }, 'factur-x generation failed')
        if (!res.headersSent) {
          res.writeHead(500)
          res.end()
        }
      })
      return
    }

    if (url.startsWith('/invoices/') && url.endsWith('.pdf') && req.method === 'GET') {
      const orderId = url.slice('/invoices/'.length, -4)
      ;(async () => {
        const order = await opts.redbird.orders.get(orderId)
        if (!order) {
          res.writeHead(404)
          res.end()
          return
        }
        const pdf = await generateInvoicePdf(order, storeName)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.number}.pdf"`)
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length })
        res.end(pdf)
      })().catch((err) => {
        if (log) log.error({ orderId, err }, 'invoice generation failed')
        if (!res.headersSent) {
          res.writeHead(500)
          res.end()
        }
      })
      return
    }

    if (url === '/setup/status' && req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ configured: true, storeName }))
      return
    }

    if (url.split('?')[0] === '/meta.json' && req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      const metaPath = META_PATH
      let fileMeta: Record<string, unknown> = {}
      try {
        if (existsSync(metaPath))
          fileMeta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>
      } catch {}
      const anonId = new URL(url, 'http://internal').searchParams.get('anon') ?? 'anonymous'
      opts.redbird.featureFlags
        .evaluateAll(anonId)
        .then((featureFlags) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              storeName,
              currency: opts.redbird.config.defaultCurrency,
              stripePublicKey: process.env.STRIPE_PUBLIC_KEY ?? null,
              theme: 'classic',
              branding: { primaryColor: '#4f46e5' },
              ...fileMeta,
              featureFlags,
            }),
          )
        })
        .catch(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              storeName,
              currency: opts.redbird.config.defaultCurrency,
              stripePublicKey: process.env.STRIPE_PUBLIC_KEY ?? null,
              theme: 'classic',
              branding: { primaryColor: '#4f46e5' },
              ...fileMeta,
              featureFlags: {},
            }),
          )
        })
      return
    }

    if (url === '/manifest.webmanifest' && req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      let fileMeta: { branding?: { primaryColor?: string } } = {}
      try {
        if (existsSync(META_PATH))
          fileMeta = JSON.parse(readFileSync(META_PATH, 'utf8')) as typeof fileMeta
      } catch {}
      const themeColor = fileMeta.branding?.primaryColor ?? '#4f46e5'
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' })
      res.end(
        JSON.stringify({
          name: storeName || 'Store',
          short_name: storeName || 'Store',
          description: `Shop ${storeName || 'online'} — browse products, track orders, and manage your account.`,
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0f0f10',
          theme_color: themeColor,
          orientation: 'portrait-primary',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        }),
      )
      return
    }

    // ── Digital download redemption ───────────────────────────────────────────
    if (url.startsWith('/download/') && req.method === 'GET') {
      const token = url.slice('/download/'.length)
      if (!token) {
        res.writeHead(400)
        res.end()
        return
      }
      ;(async () => {
        const result = await opts.redbird.downloads.redeemToken(token)
        if (!result) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(410, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Download link expired or limit reached' }))
          return
        }
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${result.filename.replace(/"/g, '\\"')}"`,
        )
        res.writeHead(302, { Location: result.url })
        res.end()
      })().catch((err) => {
        if (log) log.error({ err }, 'download redemption failed')
        if (!res.headersSent) {
          res.writeHead(500)
          res.end()
        }
      })
      return
    }

    // ── sitemap.xml ──────────────────────────────────────────────────────────
    if (url === '/sitemap.xml' && req.method === 'GET') {
      ;(async () => {
        const [prods, cats, pages] = await Promise.all([
          opts.redbird.db.query.products.findMany({
            columns: { slug: true, updatedAt: true },
            where: (p, { eq }) => eq(p.status, 'active'),
          }),
          opts.redbird.db.query.categories.findMany({
            columns: { slug: true },
          }),
          opts.redbird.db.query.cmsPages.findMany({
            columns: { slug: true, updatedAt: true },
            where: (p, { eq }) => eq(p.published, true),
          }),
        ])
        const base = opts.storefrontUrl ?? 'http://localhost:5173'
        const urls = [
          `  <url><loc>${base}/</loc></url>`,
          ...prods.map(
            (p) =>
              `  <url><loc>${base}/products/${p.slug}</loc><lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`,
          ),
          ...cats.map((c) => `  <url><loc>${base}/categories/${c.slug}</loc></url>`),
          ...pages.map(
            (p) =>
              `  <url><loc>${base}/pages/${p.slug}</loc><lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`,
          ),
        ]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' })
        res.end(xml)
      })().catch((err) => {
        if (log) log.error({ err }, 'sitemap generation failed')
        if (!res.headersSent) {
          res.writeHead(500)
          res.end()
        }
      })
      return
    }

    // ── robots.txt ───────────────────────────────────────────────────────────
    if (url === '/robots.txt' && req.method === 'GET') {
      const apiBase = opts.storefrontUrl
        ? `${opts.storefrontUrl.replace(/\/$/, '')}/api`
        : `http://localhost:3000`
      const txt = ['User-agent: *', 'Allow: /', '', `Sitemap: ${apiBase}/sitemap.xml`].join('\n')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(txt)
      return
    }

    if (url.startsWith('/webhooks/') && req.method === 'POST') {
      handleWebhookRequest(req, res, webhookHandlers, opts.redbird).catch((err) => {
        if (log) log.error({ url, err }, 'payment webhook handler failed')
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
      return
    }

    // ── SSE event stream ──────────────────────────────────────────────────────────
    if (url === '/events' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200)
      res.write(': connected\n\n')
      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n')
        } catch {
          sseClients.delete(res)
        }
      }, 25_000)
      sseClients.add(res)
      req.on('close', () => {
        sseClients.delete(res)
        clearInterval(heartbeat)
      })
      return
    }

    // ── REST API v1 ───────────────────────────────────────────────────────────
    if (url.startsWith('/api/v1/')) {
      handleRestRequest(
        req,
        res,
        opts.redbird,
        jwtSecret,
        opts.adminKey,
        rateLimiters,
        opts.trustProxy,
      ).catch((err) => {
        if (!res.headersSent) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
        if (log) log.error({ url, err }, 'REST handler error')
      })
      return
    }

    if (!url.startsWith(basePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }
    req.url = url.slice(basePath.length) || '/'

    // Cache-Control for catalog read routes (CDN / browser caching)
    if (req.method === 'GET' && url.includes('catalog.')) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    }

    trpcHandler(req, res)
  })

  let boundPort = requestedPort
  let abandonedCartTimer: ReturnType<typeof setInterval> | null = null
  let subscriptionReminderTimer: ReturnType<typeof setInterval> | null = null

  return {
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(requestedPort, () => {
          const addr = server.address()
          if (addr && typeof addr === 'object') boundPort = addr.port
          if (log) {
            log.info(
              { port: boundPort, basePath, store: opts.redbird.config.storeName ?? '' },
              'server listening',
            )
          }

          // Start abandoned cart recovery cron if configured
          const intervalMin = opts.abandonedCartIntervalMinutes ?? 0
          if (intervalMin > 0) {
            abandonedCartTimer = setInterval(
              () => {
                const recoveryOpts: Parameters<typeof opts.redbird.abandonedCart.runRecovery>[0] =
                  {}
                if (opts.storeUrl) recoveryOpts.storeUrl = opts.storeUrl
                const sn = opts.redbird.config.storeName
                if (sn) recoveryOpts.storeName = sn
                opts.redbird.abandonedCart
                  .runRecovery(recoveryOpts)
                  .then((result) => {
                    if (result.processed > 0 && log) {
                      log.info(
                        { processed: result.processed, emailed: result.emailed },
                        'abandoned-cart recovery',
                      )
                    }
                  })
                  .catch((err) => {
                    if (log) log.error({ err }, 'abandoned-cart cron error')
                  })
              },
              intervalMin * 60 * 1000,
            )
          }

          // Start subscription renewal-reminder cron if configured
          const subReminderMin = opts.subscriptionReminderIntervalMinutes ?? 0
          if (subReminderMin > 0) {
            subscriptionReminderTimer = setInterval(
              () => {
                const reminderOpts: Parameters<typeof opts.redbird.subscriptions.runReminders>[0] =
                  {}
                if (opts.storefrontUrl) reminderOpts.storeUrl = opts.storefrontUrl
                const sn = opts.redbird.config.storeName
                if (sn) reminderOpts.storeName = sn
                opts.redbird.subscriptions
                  .runReminders(reminderOpts)
                  .then((result) => {
                    if (result.due > 0 && log) {
                      log.info(
                        { due: result.due, reminded: result.reminded },
                        'subscription renewal reminders',
                      )
                    }
                  })
                  .catch((err) => {
                    if (log) log.error({ err }, 'subscription reminder cron error')
                  })
              },
              subReminderMin * 60 * 1000,
            )
          }

          resolve()
        })
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        if (abandonedCartTimer) {
          clearInterval(abandonedCartTimer)
          abandonedCartTimer = null
        }
        if (subscriptionReminderTimer) {
          clearInterval(subscriptionReminderTimer)
          subscriptionReminderTimer = null
        }
        server.close((err) => (err ? reject(err) : resolve()))
      }),
    get port() {
      return boundPort
    },
    basePath,
    /** Pino logger instance (false if logging was disabled). */
    log,
  }
}
