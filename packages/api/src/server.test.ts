import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRedbird } from '@redbirdshop/core'
import { stripe } from '@redbird/plugin-stripe'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiServer } from './server.js'

const JWT_SECRET = 'test-secret-do-not-use-in-production'
const ADMIN_KEY = 'test-admin-key'

const redbird = createRedbird({
  defaultCurrency: 'EUR',
  plugins: [stripe({ secretKey: 'sk_test_placeholder', dryRun: true })],
})
const server = createApiServer({ redbird, port: 0, basePath: '/trpc', jwtSecret: JWT_SECRET, adminKey: ADMIN_KEY })

async function trpcQuery(path: string, input: unknown, token?: string): Promise<unknown> {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function trpcMutation(path: string, input: unknown, token?: string): Promise<unknown> {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function trpcMutationRaw(path: string, input: unknown, token?: string) {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(input) })
}

async function adminQuery(path: string, input: unknown): Promise<unknown> {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
  const res = await fetch(url, { headers: { 'x-admin-key': ADMIN_KEY } })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function adminMutation(path: string, input: unknown): Promise<unknown> {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function adminMutationRaw(path: string, input: unknown) {
  const url = `http://127.0.0.1:${address.port}/trpc/${path}`
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify(input),
  })
}

let address: { port: number }

describe('API server (tRPC)', () => {
  beforeAll(async () => {
    await redbird.init()
    await server.listen()
    address = { port: server.port }
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products, customers RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await server.close()
    await redbird.close()
  })

  // ---------- Catalog ----------

  it('lists products via tRPC', async () => {
    await redbird.catalog.createProduct(
      { slug: 'test-prod', name: 'Test Product', status: 'active' },
      [{ sku: 'TP-1', name: 'Default', priceAmount: 999, priceCurrency: 'EUR' }],
    )

    const json = (await trpcQuery('catalog.list', {})) as {
      result: { data: Array<{ slug: string }> }
    }
    expect(json.result.data).toHaveLength(1)
    expect(json.result.data[0]?.slug).toBe('test-prod')
  })

  it('creates a cart and adds an item via tRPC', async () => {
    await redbird.catalog.createProduct({ slug: 'p', name: 'P', status: 'active' }, [
      { sku: 'SKU', name: 'Default', priceAmount: 500, priceCurrency: 'EUR' },
    ])
    const product = await redbird.catalog.getProductBySlug('p')
    const variantId = product?.variants[0]?.id
    if (!variantId) throw new Error('variant missing')

    const cartRes = (await trpcMutation('cart.create', { currency: 'EUR' })) as {
      result: { data: { id: string } }
    }
    const cartId = cartRes.result.data.id

    await trpcMutation('cart.addItem', { cartId, variantId, quantity: 2 })

    const subtotalRes = (await trpcQuery('cart.subtotal', { cartId })) as {
      result: { data: { amount: number; currency: string } }
    }
    expect(subtotalRes.result.data).toEqual({ amount: 1000, currency: 'EUR' })
  })

  it('returns 404 for missing product slug', async () => {
    const res = await fetch(
      `http://127.0.0.1:${address.port}/trpc/catalog.bySlug?input=${encodeURIComponent(JSON.stringify({ slug: 'nope' }))}`,
    )
    expect(res.status).toBe(404)
  })

  // ---------- Auth ----------

  it('register returns a customer and a JWT token', async () => {
    const res = (await trpcMutation('customers.register', {
      email: 'alice@example.com',
      password: 'password123',
      firstName: 'Alice',
    })) as { result: { data: { customer: { email: string; id: string }; token: string } } }

    expect(res.result.data.customer.email).toBe('alice@example.com')
    expect(typeof res.result.data.token).toBe('string')
    expect(res.result.data.token.split('.')).toHaveLength(3)
  })

  it('login returns a customer and a JWT token', async () => {
    await redbird.customers.register({ email: 'bob@example.com', password: 'password123' })

    const res = (await trpcMutation('customers.login', {
      email: 'bob@example.com',
      password: 'password123',
    })) as { result: { data: { customer: { email: string }; token: string } } }

    expect(res.result.data.customer.email).toBe('bob@example.com')
    expect(typeof res.result.data.token).toBe('string')
  })

  it('me returns the authenticated customer', async () => {
    const reg = (await trpcMutation('customers.register', {
      email: 'carol@example.com',
      password: 'password123',
    })) as { result: { data: { token: string } } }
    const token = reg.result.data.token

    const me = (await trpcQuery('customers.me', {}, token)) as {
      result: { data: { email: string } }
    }
    expect(me.result.data.email).toBe('carol@example.com')
  })

  it('me returns 401 without a token', async () => {
    const res = await fetch(
      `http://127.0.0.1:${address.port}/trpc/customers.me?input=${encodeURIComponent(JSON.stringify({}))}`,
    )
    expect(res.status).toBe(401)
  })

  it('update is protected and patches the authenticated customer', async () => {
    const reg = (await trpcMutation('customers.register', {
      email: 'dave@example.com',
      password: 'password123',
    })) as { result: { data: { token: string } } }
    const token = reg.result.data.token

    const updated = (await trpcMutation(
      'customers.update',
      { firstName: 'Dave', lastName: 'Smith' },
      token,
    )) as { result: { data: { firstName: string; lastName: string } } }

    expect(updated.result.data.firstName).toBe('Dave')
    expect(updated.result.data.lastName).toBe('Smith')
  })

  it('update returns 401 without a token', async () => {
    const res = await trpcMutationRaw('customers.update', { firstName: 'X' })
    expect(res.status).toBe(401)
  })

  it('customers.orders returns the authenticated customer orders', async () => {
    const reg = (await trpcMutation('customers.register', {
      email: 'eve@example.com',
      password: 'password123',
    })) as { result: { data: { customer: { id: string; email: string }; token: string } } }
    const { token, customer } = reg.result.data

    await redbird.catalog.createProduct({ slug: 'tea', name: 'Tea', status: 'active' }, [
      { sku: 'TEA-1', name: '50g', priceAmount: 800, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug('tea')
    const variant = p?.variants[0]!
    const cart = await redbird.cart.create({ currency: 'EUR', customerId: customer.id })
    await redbird.cart.addItem(cart.id, variant.id, 1)
    await redbird.orders.createFromCart(cart.id, { customerEmail: customer.email })

    const ordersRes = (await trpcQuery('customers.orders', {}, token)) as {
      result: { data: Array<{ customerEmail: string }> }
    }
    expect(ordersRes.result.data).toHaveLength(1)
    expect(ordersRes.result.data[0]?.customerEmail).toBe('eve@example.com')
  })

  // ---------- checkout.initiatePayment ----------

  it('initiatePayment returns a PaymentIntent (dryRun Stripe)', async () => {
    await redbird.catalog.createProduct({ slug: 'coffee', name: 'Coffee', status: 'active' }, [
      { sku: 'COF-1', name: '250g', priceAmount: 1490, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug('coffee')
    const variant = p?.variants[0]!
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variant.id, 2)
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'test@example.com',
    })

    const res = (await trpcMutation('checkout.initiatePayment', { orderId: order.id })) as {
      result: {
        data: {
          id: string
          clientSecret: string
          amount: number
          currency: string
          provider: string
        }
      }
    }

    expect(res.result.data.id).toMatch(/^pi_demo_/)
    expect(res.result.data.clientSecret).toMatch(/_secret_demo$/)
    expect(res.result.data.amount).toBe(2980)
    expect(res.result.data.currency).toBe('eur')
    expect(res.result.data.provider).toBe('@redbird/plugin-stripe')
  })

  it('initiatePayment returns 400 for a non-pending order', async () => {
    await redbird.catalog.createProduct({ slug: 'mug', name: 'Mug', status: 'active' }, [
      { sku: 'MUG-1', name: 'Default', priceAmount: 1200, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug('mug')
    const variant = p?.variants[0]!
    const cart = await redbird.cart.create({ currency: 'EUR' })
    await redbird.cart.addItem(cart.id, variant.id, 1)
    const order = await redbird.orders.createFromCart(cart.id, {
      customerEmail: 'test@example.com',
    })
    await redbird.orders.markPaid(order.id)

    const res = await trpcMutationRaw('checkout.initiatePayment', { orderId: order.id })
    expect(res.status).toBe(400)
  })

  it('initiatePayment returns 400 when no payment provider is configured', async () => {
    const redbirdNoPay = createRedbird({ defaultCurrency: 'EUR' })
    const serverNoPay = createApiServer({
      redbird: redbirdNoPay,
      port: 0,
      basePath: '/trpc',
      jwtSecret: JWT_SECRET,
    })
    await redbirdNoPay.init()
    await serverNoPay.listen()

    await redbirdNoPay.catalog.createProduct({ slug: 'item', name: 'Item', status: 'active' }, [
      { sku: 'ITEM-1', name: 'Default', priceAmount: 500, priceCurrency: 'EUR' },
    ])
    const p = await redbirdNoPay.catalog.getProductBySlug('item')
    const variant = p?.variants[0]!
    const cart = await redbirdNoPay.cart.create({ currency: 'EUR' })
    await redbirdNoPay.cart.addItem(cart.id, variant.id, 1)
    const order = await redbirdNoPay.orders.createFromCart(cart.id, {
      customerEmail: 'test@example.com',
    })

    const url = `http://127.0.0.1:${serverNoPay.port}/trpc/checkout.initiatePayment`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    })
    expect(res.status).toBe(400)

    await serverNoPay.close()
    await redbirdNoPay.close()
  })

  // ---------- Admin endpoints ----------

  describe('admin.plugins.listInstalled', () => {
    it('returns an array (empty when no plugins stored in meta)', async () => {
      const res = (await adminQuery('admin.plugins.listInstalled', {})) as {
        result: { data: Array<{ name: string; config: Record<string, unknown> }> }
      }
      // The meta.json may have installedPlugins or not — either way it must be an array
      expect(Array.isArray(res.result.data)).toBe(true)
    })
  })

  describe('admin.emails.sendTest', () => {
    it('returns 412 when no local email plugin is active', async () => {
      // The main test server uses only the Stripe plugin — localEmails is null
      const res = await adminMutationRaw('admin.emails.sendTest', {})
      expect(res.status).toBe(412)
    })
  })

  describe('admin.config.update licenseKey + admin.config.get', () => {
    const metaPath = resolve(process.cwd(), 'redbird.meta.json')
    let originalMeta: string | null = null

    beforeAll(() => {
      // Save the current meta.json so we can restore it after the test
      try {
        originalMeta = readFileSync(metaPath, 'utf8')
      } catch {
        originalMeta = null
      }
    })

    afterAll(() => {
      // Restore meta.json to its original state
      if (originalMeta !== null) {
        writeFileSync(metaPath, originalMeta)
      }
    })

    it('saves licenseKey to meta.json and config.get returns it', async () => {
      // Mock reloadLicense to avoid a real network call (would timeout after 5s)
      const spy = vi.spyOn(redbird, 'reloadLicense').mockResolvedValue(null)

      try {
        const updateRes = (await adminMutation('admin.config.update', {
          licenseKey: 'test-license-key-abc123',
        })) as { result: { data: { ok: boolean } } }
        expect(updateRes.result.data.ok).toBe(true)

        // reloadLicense must have been called with the provided key
        expect(spy).toHaveBeenCalledWith('test-license-key-abc123')

        // config.get must reflect the saved licenseKey
        const getRes = (await adminQuery('admin.config.get', {})) as {
          result: { data: { licenseKey: string; defaultCurrency: string } }
        }
        expect(getRes.result.data.licenseKey).toBe('test-license-key-abc123')
        expect(getRes.result.data.defaultCurrency).toBe('EUR')
      } finally {
        spy.mockRestore()
      }
    })
  })
})
