import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Redbird } from '@redbirdshop/core'
import type { RateLimiters } from '@redbirdshop/trpc'
import { TRPCError } from '@trpc/server'
import { createContext } from './context.js'
import { buildOpenApiSpec } from './openapi.js'
import { appRouter } from './routers/index.js'

const TRPC_HTTP_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
}

function json(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.writeHead(status)
  res.end(body)
}

function notFound(res: ServerResponse) {
  json(res, 404, { error: 'Not found' })
}

function badRequest(res: ServerResponse, message: string) {
  json(res, 400, { error: message })
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Handle a REST API request. Returns true if handled, false to fall through.
 *
 * Everything below /orders, /checkout and /customers/me delegates to the same
 * tRPC procedures the storefront uses (via appRouter.createCaller) instead of
 * reimplementing checkout/pricing logic a second time here — that logic is
 * deliberately non-trivial (server-side price/tax recomputation, promo/gift-
 * card/loyalty stacking) and duplicating it would be a real drift risk.
 */
export async function handleRestRequest(
  req: IncomingMessage,
  res: ServerResponse,
  redbird: Redbird,
  jwtSecret: string,
  adminKey?: string | undefined,
  rateLimiters?: RateLimiters | undefined,
  trustProxy = false,
): Promise<boolean> {
  const url = req.url ?? ''
  const method = req.method ?? 'GET'

  if (!url.startsWith('/api/v1/')) return false

  // CORS preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.writeHead(204)
    res.end()
    return true
  }

  const path = url.slice('/api/v1'.length).split('?')[0]!
  const query = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')

  try {
    // ── GET /api/v1/openapi.json ──────────────────────────────────────────────
    if (path === '/openapi.json' && method === 'GET') {
      const proto = req.headers['x-forwarded-proto'] ?? 'http'
      const host = req.headers.host ?? 'localhost:3000'
      json(res, 200, buildOpenApiSpec(`${proto}://${host}`))
      return true
    }

    // ── GET /api/v1/products ──────────────────────────────────────────────────
    if (path === '/products' && method === 'GET') {
      const limit = Math.min(Number.parseInt(query.get('limit') ?? '20', 10) || 20, 100)
      const offset = Number.parseInt(query.get('offset') ?? '0', 10) || 0
      const sortBy =
        (query.get('sort') as 'newest' | 'price_asc' | 'price_desc' | 'name' | null) ?? 'newest'
      const products = await redbird.catalog.listProducts({
        limit,
        offset,
        status: 'active',
        sortBy,
      })
      json(res, 200, { data: products, meta: { limit, offset, count: products.length } })
      return true
    }

    // ── GET /api/v1/products/search ───────────────────────────────────────────
    if (path === '/products/search' && method === 'GET') {
      const q = query.get('q') ?? ''
      if (!q.trim()) {
        badRequest(res, 'q parameter required')
        return true
      }
      const limit = Math.min(Number.parseInt(query.get('limit') ?? '20', 10) || 20, 50)
      const results = await redbird.catalog.search(q.trim(), { limit, status: 'active' })
      json(res, 200, { data: results, meta: { q, count: results.length } })
      return true
    }

    // ── GET /api/v1/products/:slug ────────────────────────────────────────────
    const productSlugMatch = path.match(/^\/products\/([^/]+)$/)
    if (productSlugMatch && method === 'GET') {
      const slug = productSlugMatch[1]!
      const product = await redbird.catalog.getProductBySlug(slug)
      if (!product) {
        notFound(res)
        return true
      }
      json(res, 200, { data: product })
      return true
    }

    // ── GET /api/v1/categories ────────────────────────────────────────────────
    if (path === '/categories' && method === 'GET') {
      const cats = await redbird.categories.list()
      json(res, 200, { data: cats })
      return true
    }

    // ── GET /api/v1/categories/:slug ──────────────────────────────────────────
    const categorySlugMatch = path.match(/^\/categories\/([^/]+)$/)
    if (categorySlugMatch && method === 'GET') {
      const slug = categorySlugMatch[1]!
      const category = await redbird.categories.getBySlug(slug)
      if (!category) {
        notFound(res)
        return true
      }
      const limit = Math.min(Number.parseInt(query.get('limit') ?? '20', 10) || 20, 100)
      const offset = Number.parseInt(query.get('offset') ?? '0', 10) || 0
      const products = await redbird.categories.listProducts(category.id, { limit, offset })
      json(res, 200, { data: { ...category, products } })
      return true
    }

    // ── GET /api/v1/brands ────────────────────────────────────────────────────
    if (path === '/brands' && method === 'GET') {
      const brands = await redbird.brands.list()
      json(res, 200, { data: brands })
      return true
    }

    // ── GET /api/v1/carts/:id ─────────────────────────────────────────────────
    const cartMatch = path.match(/^\/carts\/([^/]+)$/)
    if (cartMatch && method === 'GET') {
      const cart = await redbird.cart.get(cartMatch[1]!)
      if (!cart) {
        notFound(res)
        return true
      }
      json(res, 200, { data: cart })
      return true
    }

    // ── POST /api/v1/carts ────────────────────────────────────────────────────
    if (path === '/carts' && method === 'POST') {
      const body = (await parseBody(req)) as {
        currency?: string
        customerEmail?: string
      }
      const currency =
        typeof body.currency === 'string' && body.currency
          ? body.currency
          : (redbird.config.defaultCurrency ?? 'USD')
      const createOpts: { currency: string; customerEmail?: string } = { currency }
      if (typeof body.customerEmail === 'string' && body.customerEmail) {
        createOpts.customerEmail = body.customerEmail
      }
      const cart = await redbird.cart.create(createOpts)
      json(res, 201, { data: cart })
      return true
    }

    // ── POST /api/v1/carts/:id/items ──────────────────────────────────────────
    const cartItemsMatch = path.match(/^\/carts\/([^/]+)\/items$/)
    if (cartItemsMatch && method === 'POST') {
      const body = (await parseBody(req)) as { variantId?: string; quantity?: number }
      if (!body.variantId) {
        badRequest(res, 'variantId required')
        return true
      }
      const qty = Math.max(1, Number.parseInt(String(body.quantity ?? 1), 10) || 1)
      const lineItem = await redbird.cart.addItem(cartItemsMatch[1]!, body.variantId, qty)
      json(res, 200, { data: lineItem })
      return true
    }

    // ── DELETE /api/v1/carts/:id/items/:itemId ────────────────────────────────
    const cartItemMatch = path.match(/^\/carts\/([^/]+)\/items\/([^/]+)$/)
    if (cartItemMatch && method === 'DELETE') {
      await redbird.cart.removeItem(cartItemMatch[1]!, cartItemMatch[2]!)
      json(res, 200, { data: null })
      return true
    }

    // The remaining routes go through the tRPC caller (see the doc comment above).
    const ctx = await createContext(redbird, req, jwtSecret, adminKey, rateLimiters, trustProxy)
    const caller = appRouter.createCaller(ctx)

    // ── Admin — catalog & inventory (headless admin/PIM integration) ───────────
    // Auth: "x-admin-key: <key>" or "x-staff-token: <staff JWT>", same as the
    // backoffice. adminProcedure/warehouseProcedure enforce it — a request
    // without proper credentials throws UNAUTHORIZED before reaching here.

    if (path === '/admin/products' && method === 'GET') {
      const limit = Math.min(Number.parseInt(query.get('limit') ?? '20', 10) || 20, 100)
      const offset = Number.parseInt(query.get('offset') ?? '0', 10) || 0
      const status = query.get('status') as 'draft' | 'active' | 'archived' | null
      const products = await caller.admin.catalog.list({
        limit,
        offset,
        ...(status ? { status } : {}),
      })
      json(res, 200, { data: products, meta: { limit, offset, count: products.length } })
      return true
    }

    if (path === '/admin/products' && method === 'POST') {
      const body = await parseBody(req)
      const product = await caller.admin.catalog.create(
        body as Parameters<typeof caller.admin.catalog.create>[0],
      )
      json(res, 201, { data: product })
      return true
    }

    const adminProductMatch = path.match(/^\/admin\/products\/([^/]+)$/)
    if (adminProductMatch && method === 'GET') {
      const product = await caller.admin.catalog.byId({ id: adminProductMatch[1]! })
      if (!product) {
        notFound(res)
        return true
      }
      json(res, 200, { data: product })
      return true
    }

    if (adminProductMatch && (method === 'PATCH' || method === 'PUT')) {
      const body = (await parseBody(req)) as Record<string, unknown>
      const product = await caller.admin.catalog.update({
        id: adminProductMatch[1]!,
        ...body,
      } as Parameters<typeof caller.admin.catalog.update>[0])
      json(res, 200, { data: product })
      return true
    }

    if (adminProductMatch && method === 'DELETE') {
      await caller.admin.catalog.delete({ id: adminProductMatch[1]! })
      json(res, 200, { data: null })
      return true
    }

    const adminVariantsMatch = path.match(/^\/admin\/products\/([^/]+)\/variants$/)
    if (adminVariantsMatch && method === 'POST') {
      const body = (await parseBody(req)) as Record<string, unknown>
      const variant = await caller.admin.catalog.addVariant({
        productId: adminVariantsMatch[1]!,
        ...body,
      } as Parameters<typeof caller.admin.catalog.addVariant>[0])
      json(res, 201, { data: variant })
      return true
    }

    const adminVariantMatch = path.match(/^\/admin\/variants\/([^/]+)$/)
    if (adminVariantMatch && (method === 'PATCH' || method === 'PUT')) {
      const body = (await parseBody(req)) as Record<string, unknown>
      const variant = await caller.admin.catalog.updateVariant({
        id: adminVariantMatch[1]!,
        ...body,
      } as Parameters<typeof caller.admin.catalog.updateVariant>[0])
      json(res, 200, { data: variant })
      return true
    }

    if (adminVariantMatch && method === 'DELETE') {
      await caller.admin.catalog.deleteVariant({ id: adminVariantMatch[1]! })
      json(res, 200, { data: null })
      return true
    }

    const adminStockMatch = path.match(/^\/admin\/stock\/([^/]+)$/)
    if (adminStockMatch && method === 'GET') {
      const stock = await caller.admin.stock.get({ variantId: adminStockMatch[1]! })
      json(res, 200, { data: stock })
      return true
    }

    if (adminStockMatch && (method === 'PATCH' || method === 'PUT')) {
      const body = (await parseBody(req)) as { quantity?: number; delta?: number }
      const stock =
        body.delta !== undefined
          ? await caller.admin.stock.adjust({ variantId: adminStockMatch[1]!, delta: body.delta })
          : await caller.admin.stock.set({
              variantId: adminStockMatch[1]!,
              quantity: body.quantity ?? 0,
            })
      json(res, 200, { data: stock })
      return true
    }

    // ── GET /api/v1/orders/:number ────────────────────────────────────────────
    // Public by design, same as the tRPC procedure it delegates to: order
    // numbers are high-entropy and treated as the "receipt lookup" token for
    // guest order tracking, not something that needs a login.
    const orderNumberMatch = path.match(/^\/orders\/([^/]+)$/)
    if (orderNumberMatch && method === 'GET') {
      const order = await caller.checkout.getByNumber({ number: orderNumberMatch[1]! })
      json(res, 200, { data: order })
      return true
    }

    // ── POST /api/v1/checkout ─────────────────────────────────────────────────
    if (path === '/checkout' && method === 'POST') {
      const body = await parseBody(req)
      const order = await caller.checkout.createOrder(
        body as Parameters<typeof caller.checkout.createOrder>[0],
      )
      json(res, 201, { data: order })
      return true
    }

    // ── GET /api/v1/customers/me ──────────────────────────────────────────────
    // Requires "Authorization: Bearer <customer JWT>" — same token the storefront uses.
    if (path === '/customers/me' && method === 'GET') {
      const customer = await caller.customers.me()
      json(res, 200, { data: customer })
      return true
    }

    // ── GET /api/v1/customers/me/orders ───────────────────────────────────────
    if (path === '/customers/me/orders' && method === 'GET') {
      const orders = await caller.customers.orders({})
      json(res, 200, { data: orders })
      return true
    }
  } catch (err) {
    if (err instanceof TRPCError) {
      json(res, TRPC_HTTP_STATUS[err.code] ?? 500, { error: err.message })
      return true
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    json(res, 500, { error: message })
    return true
  }

  return false
}
