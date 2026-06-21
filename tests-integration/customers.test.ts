import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Customers (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products, customers RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  it('registers a new customer', async () => {
    const customer = await redbird.customers.register({
      email: 'alice@example.com',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Dupont',
    })

    expect(customer.email).toBe('alice@example.com')
    expect(customer.firstName).toBe('Alice')
    expect(customer.lastName).toBe('Dupont')
    expect(customer.id).toBeDefined()
    expect('passwordHash' in customer).toBe(false)
  })

  it('normalises email to lowercase on register', async () => {
    const customer = await redbird.customers.register({
      email: 'BOB@EXAMPLE.COM',
      password: 'password123',
    })
    expect(customer.email).toBe('bob@example.com')
  })

  it('rejects duplicate email', async () => {
    await redbird.customers.register({ email: 'dup@example.com', password: 'pass1234' })
    await expect(
      redbird.customers.register({ email: 'dup@example.com', password: 'pass5678' }),
    ).rejects.toThrow(/already registered/)
  })

  it('login succeeds with correct credentials', async () => {
    await redbird.customers.register({ email: 'charlie@example.com', password: 'correct-pw' })
    const logged = await redbird.customers.login('charlie@example.com', 'correct-pw')

    expect(logged).not.toBeNull()
    expect(logged?.email).toBe('charlie@example.com')
    expect('passwordHash' in (logged ?? {})).toBe(false)
  })

  it('login is case-insensitive on email', async () => {
    await redbird.customers.register({ email: 'dave@example.com', password: 'correct-pw' })
    const logged = await redbird.customers.login('DAVE@EXAMPLE.COM', 'correct-pw')
    expect(logged).not.toBeNull()
  })

  it('login returns null on wrong password', async () => {
    await redbird.customers.register({ email: 'eve@example.com', password: 'correct-pw' })
    const result = await redbird.customers.login('eve@example.com', 'wrong-pw')
    expect(result).toBeNull()
  })

  it('login returns null for unknown email', async () => {
    const result = await redbird.customers.login('nobody@example.com', 'pw')
    expect(result).toBeNull()
  })

  it('get returns customer without passwordHash', async () => {
    const created = await redbird.customers.register({
      email: 'frank@example.com',
      password: 'pass1234',
    })
    const fetched = await redbird.customers.get(created.id)

    expect(fetched?.id).toBe(created.id)
    expect('passwordHash' in (fetched ?? {})).toBe(false)
  })

  it('getByEmail finds customer', async () => {
    await redbird.customers.register({ email: 'grace@example.com', password: 'pass1234' })
    const found = await redbird.customers.getByEmail('grace@example.com')
    expect(found).not.toBeNull()
  })

  it('update patches name fields', async () => {
    const customer = await redbird.customers.register({
      email: 'henry@example.com',
      password: 'pass1234',
    })
    const updated = await redbird.customers.update(customer.id, {
      firstName: 'Henry',
      lastName: 'Martin',
    })

    expect(updated.firstName).toBe('Henry')
    expect(updated.lastName).toBe('Martin')
    expect(updated.email).toBe('henry@example.com')
  })

  it('associates orders with customer', async () => {
    const customer = await redbird.customers.register({
      email: 'iris@example.com',
      password: 'pass1234',
    })

    await redbird.catalog.createProduct({ slug: 'tea', name: 'Earl Grey', status: 'active' }, [
      { sku: 'TEA-1', name: '50g', priceAmount: 800, priceCurrency: 'EUR' },
    ])
    const p = await redbird.catalog.getProductBySlug('tea')
    const variant = p?.variants[0]!
    const cart = await redbird.cart.create({ currency: 'EUR', customerId: customer.id })
    await redbird.cart.addItem(cart.id, variant.id, 2)

    await redbird.orders.createFromCart(cart.id, { customerEmail: customer.email })

    const orders = await redbird.orders.list({ customerId: customer.id })
    expect(orders).toHaveLength(1)
    expect(orders[0]?.customerEmail).toBe('iris@example.com')
  })
})
