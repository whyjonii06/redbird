import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

describe('loyalty service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await rb.init()
  })

  beforeEach(async () => {
    await rb.db.execute(
      sql`TRUNCATE TABLE loyalty_transactions, loyalty_accounts, customers RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await rb.close()
  })

  async function newCustomerId(): Promise<string> {
    const c = await rb.customers.register({
      email: `${randomUUID()}@test.com`,
      password: 'password123',
    })
    return c.id
  }

  it('getBalance returns 0 when no account exists', async () => {
    // Use a real customer so the FK is satisfied when getBalance creates an account internally
    // Note: getBalance only reads, doesn't insert, so a random UUID is fine here
    const balance = await rb.loyalty.getBalance(randomUUID())
    expect(balance).toBe(0)
  })

  it('earn adds correct points (floor of cents/100 × rate)', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    // 1000 cents = 10 EUR × rate 2 = 20 pts
    const tx = await rb.loyalty.earn(customerId, orderId, 1000, 2)
    expect(tx.points).toBe(20)
    expect(tx.type).toBe('earn')

    const balance = await rb.loyalty.getBalance(customerId)
    expect(balance).toBe(20)
  })

  it('earn with 1 pt/euro rate computes floor correctly', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    // 350 cents = 3.5 EUR × 1 = floor(3.5) = 3 pts
    await rb.loyalty.earn(customerId, orderId, 350, 1)
    expect(await rb.loyalty.getBalance(customerId)).toBe(3)
  })

  it('earn with tiny order inserts 0-point transaction', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    // 50 cents × rate 1 = 0.5 → floor = 0
    const tx = await rb.loyalty.earn(customerId, orderId, 50, 1)
    expect(tx.points).toBe(0)
    expect(await rb.loyalty.getBalance(customerId)).toBe(0)
  })

  it('redeem deducts points from balance', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    await rb.loyalty.earn(customerId, orderId, 5000, 1) // 50 pts
    const tx = await rb.loyalty.redeem(customerId, 10, 'test redemption')
    expect(tx.points).toBe(-10)
    expect(tx.type).toBe('spend')
    expect(await rb.loyalty.getBalance(customerId)).toBe(40)
  })

  it('redeem throws when balance is insufficient', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    await rb.loyalty.earn(customerId, orderId, 500, 1) // 5 pts
    await expect(rb.loyalty.redeem(customerId, 10, 'over-spend')).rejects.toThrow(
      /Insufficient loyalty points/,
    )
  })

  it('adjust positive adds points', async () => {
    const customerId = await newCustomerId()
    await rb.loyalty.adjust(customerId, 100, 'welcome bonus')
    expect(await rb.loyalty.getBalance(customerId)).toBe(100)
  })

  it('adjust negative subtracts points', async () => {
    const customerId = await newCustomerId()
    await rb.loyalty.adjust(customerId, 50, 'credit')
    await rb.loyalty.adjust(customerId, -20, 'correction')
    expect(await rb.loyalty.getBalance(customerId)).toBe(30)
  })

  it('adjust clamps balance at 0 (no negative balance)', async () => {
    const customerId = await newCustomerId()
    await rb.loyalty.adjust(customerId, 10, 'initial')
    await rb.loyalty.adjust(customerId, -100, 'large deduction')
    expect(await rb.loyalty.getBalance(customerId)).toBe(0)
  })

  it('previewRedeem computes cents from points × rate', async () => {
    expect(rb.loyalty.previewRedeem(50, 2)).toBe(100)
    expect(rb.loyalty.previewRedeem(7, 1.5)).toBe(10)
  })

  it('getTransactions returns history newest-first', async () => {
    const customerId = await newCustomerId()
    const orderId = undefined
    await rb.loyalty.earn(customerId, orderId, 2000, 1) // 20 pts
    await rb.loyalty.adjust(customerId, 5, 'bonus')

    const txs = await rb.loyalty.getTransactions(customerId)
    expect(txs.length).toBeGreaterThanOrEqual(2)
    const types = txs.map((t) => t.type)
    expect(types[0]).toBe('adjust')
    expect(types[1]).toBe('earn')
  })
})
