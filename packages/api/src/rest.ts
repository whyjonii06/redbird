import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Redbird } from '@redbirdshop/core'

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
 */
export async function handleRestRequest(
  req: IncomingMessage,
  res: ServerResponse,
  redbird: Redbird,
): Promise<boolean> {
  const url = req.url ?? ''
  const method = req.method ?? 'GET'

  if (!url.startsWith('/api/v1/')) return false

  // CORS preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.writeHead(204)
    res.end()
    return true
  }

  const path = url.slice('/api/v1'.length).split('?')[0]!
  const query = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')

  try {
    // ── GET /api/v1/products ──────────────────────────────────────────────────
    if (path === '/products' && method === 'GET') {
      const limit = Math.min(parseInt(query.get('limit') ?? '20', 10) || 20, 100)
      const offset = parseInt(query.get('offset') ?? '0', 10) || 0
      const sortBy =
        (query.get('sort') as 'newest' | 'price_asc' | 'price_desc' | 'name' | null) ?? 'newest'
      const products = await redbird.catalog.listProducts({ limit, offset, status: 'active', sortBy })
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
      const limit = Math.min(parseInt(query.get('limit') ?? '20', 10) || 20, 50)
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
      const limit = Math.min(parseInt(query.get('limit') ?? '20', 10) || 20, 100)
      const offset = parseInt(query.get('offset') ?? '0', 10) || 0
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
      const qty = Math.max(1, parseInt(String(body.quantity ?? 1), 10) || 1)
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    json(res, 500, { error: message })
    return true
  }

  return false
}
