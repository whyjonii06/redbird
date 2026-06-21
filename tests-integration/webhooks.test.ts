import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

function makeFetchMock(status: number, body = 'OK') {
  return vi.fn().mockResolvedValue({
    status,
    text: async () => body,
  })
}

describe('webhook service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await rb.init()
  })

  beforeEach(async () => {
    await rb.db.execute(
      sql`TRUNCATE TABLE webhook_deliveries, webhooks RESTART IDENTITY CASCADE`,
    )
    vi.stubGlobal('fetch', makeFetchMock(200))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await rb.close()
  })

  it('create generates a secret when none provided', async () => {
    const wh = await rb.webhooks.create({ url: 'https://example.com/hook', events: ['order.paid'] })
    expect(wh.secret).toBeTruthy()
    expect(wh.secret.length).toBeGreaterThan(10)
    expect(wh.active).toBe(true)
  })

  it('create uses explicit secret when provided', async () => {
    const wh = await rb.webhooks.create({
      url: 'https://example.com/hook',
      events: ['order.paid'],
      secret: 'my-known-secret',
    })
    expect(wh.secret).toBe('my-known-secret')
  })

  it('list returns all created webhooks', async () => {
    await rb.webhooks.create({ url: 'https://a.com/1', events: ['order.paid'] })
    await rb.webhooks.create({ url: 'https://a.com/2', events: ['order.fulfilled'] })
    const list = await rb.webhooks.list()
    expect(list).toHaveLength(2)
  })

  it('get returns webhook by id', async () => {
    const wh = await rb.webhooks.create({ url: 'https://example.com/hook', events: ['cart.created'] })
    const fetched = await rb.webhooks.get(wh.id)
    expect(fetched?.id).toBe(wh.id)
    expect(fetched?.events).toEqual(['cart.created'])
  })

  it('get returns null for unknown id', async () => {
    const result = await rb.webhooks.get(randomUUID())
    expect(result).toBeNull()
  })

  it('update toggles active status', async () => {
    const wh = await rb.webhooks.create({ url: 'https://example.com/hook', events: ['*'] })
    const updated = await rb.webhooks.update(wh.id, { active: false })
    expect(updated.active).toBe(false)
  })

  it('update changes events list', async () => {
    const wh = await rb.webhooks.create({ url: 'https://example.com/hook', events: ['order.paid'] })
    const updated = await rb.webhooks.update(wh.id, { events: ['order.paid', 'order.fulfilled'] })
    expect(updated.events).toEqual(['order.paid', 'order.fulfilled'])
  })

  it('delete removes the webhook', async () => {
    const wh = await rb.webhooks.create({ url: 'https://example.com/hook', events: ['*'] })
    await rb.webhooks.delete(wh.id)
    const list = await rb.webhooks.list()
    expect(list.find((w) => w.id === wh.id)).toBeUndefined()
  })

  it('dispatch calls fetch for matching event and stores success delivery', async () => {
    const fetchMock = makeFetchMock(200, 'received')
    vi.stubGlobal('fetch', fetchMock)

    const wh = await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'] })
    await rb.webhooks.dispatch('order.paid', { orderId: 'abc' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe('https://hooks.test/ep')
    expect(init.headers['X-Redbird-Event']).toBe('order.paid')
    expect(init.headers['X-Redbird-Signature']).toMatch(/^sha256=/)

    const deliveries = await rb.webhooks.listDeliveries(wh.id)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.status).toBe('success')
    expect(deliveries[0]?.responseStatus).toBe(200)
  })

  it('dispatch with wildcard events sends all events', async () => {
    const fetchMock = makeFetchMock(200)
    vi.stubGlobal('fetch', fetchMock)

    await rb.webhooks.create({ url: 'https://hooks.test/all', events: ['*'] })
    await rb.webhooks.dispatch('some.random.event', { data: 42 })

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('dispatch does not call fetch when no webhook matches', async () => {
    const fetchMock = makeFetchMock(200)
    vi.stubGlobal('fetch', fetchMock)

    await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'] })
    await rb.webhooks.dispatch('cart.created', { cartId: 'x' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatch skips inactive webhooks', async () => {
    const fetchMock = makeFetchMock(200)
    vi.stubGlobal('fetch', fetchMock)

    await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'], active: false })
    await rb.webhooks.dispatch('order.paid', {})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatch stores failed delivery when HTTP 500 returned', async () => {
    vi.stubGlobal('fetch', makeFetchMock(500, 'Internal Server Error'))

    const wh = await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'] })
    await rb.webhooks.dispatch('order.paid', {})

    const deliveries = await rb.webhooks.listDeliveries(wh.id)
    expect(deliveries[0]?.status).toBe('failed')
    expect(deliveries[0]?.error).toMatch(/HTTP 500/)
  })

  it('dispatch stores failed delivery when fetch throws, without rethrowing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const wh = await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'] })
    // must not throw
    await expect(rb.webhooks.dispatch('order.paid', {})).resolves.toBeUndefined()

    const deliveries = await rb.webhooks.listDeliveries(wh.id)
    expect(deliveries[0]?.status).toBe('failed')
    expect(deliveries[0]?.error).toMatch(/network error/)
  })

  it('listDeliveries returns deliveries for a webhook', async () => {
    const fetchMock = makeFetchMock(200)
    vi.stubGlobal('fetch', fetchMock)

    const wh = await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['*'] })
    await rb.webhooks.dispatch('order.paid', { a: 1 })
    await rb.webhooks.dispatch('order.fulfilled', { b: 2 })

    const deliveries = await rb.webhooks.listDeliveries(wh.id)
    expect(deliveries).toHaveLength(2)
  })

  it('redeliver retries and updates delivery status', async () => {
    // First dispatch fails
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const wh = await rb.webhooks.create({ url: 'https://hooks.test/ep', events: ['order.paid'] })
    await rb.webhooks.dispatch('order.paid', { orderId: 'xyz' })

    const [failedDelivery] = await rb.webhooks.listDeliveries(wh.id)
    expect(failedDelivery?.status).toBe('failed')

    // Now redeliver with a working endpoint
    vi.stubGlobal('fetch', makeFetchMock(200, 'retry ok'))
    if (!failedDelivery) throw new Error('delivery missing')
    const retried = await rb.webhooks.redeliver(failedDelivery.id)

    expect(retried.status).toBe('success')
    expect(retried.attempts).toBe(2)
    expect(retried.responseStatus).toBe(200)
  })
})
