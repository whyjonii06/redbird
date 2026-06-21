import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRedbird } from '../packages/core/src/redbird.js'

describe('gift card service', () => {
  const rb = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await rb.init()
  })

  beforeEach(async () => {
    await rb.db.execute(
      sql`TRUNCATE TABLE gift_card_transactions, gift_cards RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await rb.close()
  })

  it('create generates a code when none is provided', async () => {
    const card = await rb.giftCards.create({ balance: 5000, currency: 'EUR' })
    expect(card.code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/)
    expect(card.balance).toBe(5000)
    expect(card.initialBalance).toBe(5000)
    expect(card.currency).toBe('EUR')
  })

  it('create uses the explicit code provided', async () => {
    const card = await rb.giftCards.create({ balance: 2000, currency: 'EUR', code: 'GIFT-TEST-1234' })
    expect(card.code).toBe('GIFT-TEST-1234')
  })

  it('create normalises code to uppercase', async () => {
    const card = await rb.giftCards.create({ balance: 1000, currency: 'EUR', code: 'abcd-efgh' })
    expect(card.code).toBe('ABCD-EFGH')
  })

  it('get retrieves card by code', async () => {
    const created = await rb.giftCards.create({ balance: 3000, currency: 'EUR', code: 'GET-BY-CODE' })
    const fetched = await rb.giftCards.get('get-by-code') // lowercase → normalised
    expect(fetched?.id).toBe(created.id)
  })

  it('getById retrieves card by id', async () => {
    const created = await rb.giftCards.create({ balance: 1500, currency: 'EUR' })
    const fetched = await rb.giftCards.getById(created.id)
    expect(fetched?.id).toBe(created.id)
  })

  it('getById returns null for unknown id', async () => {
    const result = await rb.giftCards.getById(randomUUID())
    expect(result).toBeNull()
  })

  it('validate returns valid result with balance', async () => {
    const card = await rb.giftCards.create({ balance: 5000, currency: 'EUR' })
    const result = await rb.giftCards.validate(card.code, 'EUR')
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.balance).toBe(5000)
    }
  })

  it('validate returns not_found for unknown code', async () => {
    const result = await rb.giftCards.validate('XXXX-XXXX-XXXX-XXXX', 'EUR')
    expect(result).toEqual({ valid: false, reason: 'not_found' })
  })

  it('validate returns expired for past expiry', async () => {
    const card = await rb.giftCards.create({
      balance: 5000,
      currency: 'EUR',
      expiresAt: new Date('2000-01-01'),
    })
    const result = await rb.giftCards.validate(card.code, 'EUR')
    expect(result).toEqual({ valid: false, reason: 'expired' })
  })

  it('validate returns empty when balance is 0', async () => {
    const card = await rb.giftCards.create({ balance: 0, currency: 'EUR' })
    const result = await rb.giftCards.validate(card.code, 'EUR')
    expect(result).toEqual({ valid: false, reason: 'empty' })
  })

  it('validate returns currency_mismatch for wrong currency', async () => {
    const card = await rb.giftCards.create({ balance: 5000, currency: 'USD' })
    const result = await rb.giftCards.validate(card.code, 'EUR')
    expect(result).toEqual({ valid: false, reason: 'currency_mismatch' })
  })

  it('redeem deducts exact amount from balance', async () => {
    const card = await rb.giftCards.create({ balance: 10000, currency: 'EUR' })
    const updated = await rb.giftCards.redeem(card.code, 3000, randomUUID())
    expect(updated.balance).toBe(7000)
  })

  it('redeem deducts only available balance when amount > balance', async () => {
    const card = await rb.giftCards.create({ balance: 1000, currency: 'EUR' })
    const updated = await rb.giftCards.redeem(card.code, 5000, randomUUID())
    expect(updated.balance).toBe(0)
  })

  it('void sets balance to 0', async () => {
    const card = await rb.giftCards.create({ balance: 5000, currency: 'EUR' })
    await rb.giftCards.void(card.id)
    const fetched = await rb.giftCards.getById(card.id)
    expect(fetched?.balance).toBe(0)
  })

  it('list returns created cards', async () => {
    await rb.giftCards.create({ balance: 1000, currency: 'EUR' })
    await rb.giftCards.create({ balance: 2000, currency: 'EUR' })
    const cards = await rb.giftCards.list()
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })
})
