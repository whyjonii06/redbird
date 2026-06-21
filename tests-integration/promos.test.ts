import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Promo codes (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(sql`TRUNCATE TABLE promo_codes RESTART IDENTITY CASCADE`)
  })

  afterAll(async () => {
    await redbird.close()
  })

  // ---- create / get / list ----

  it('creates a percentage promo code', async () => {
    const promo = await redbird.promos.create({ code: 'SUMMER20', type: 'percentage', value: 20 })
    expect(promo.code).toBe('SUMMER20')
    expect(promo.type).toBe('percentage')
    expect(promo.value).toBe(20)
    expect(promo.active).toBe(true)
    expect(promo.usedCount).toBe(0)
  })

  it('normalises code to uppercase', async () => {
    const promo = await redbird.promos.create({
      code: 'welcome5',
      type: 'fixed',
      value: 500,
      currency: 'EUR',
    })
    expect(promo.code).toBe('WELCOME5')
  })

  it('gets a promo by code (case-insensitive)', async () => {
    await redbird.promos.create({ code: 'TEST10', type: 'percentage', value: 10 })
    const found = await redbird.promos.get('test10')
    expect(found?.code).toBe('TEST10')
  })

  it('returns null for unknown code', async () => {
    expect(await redbird.promos.get('NOPE')).toBeNull()
  })

  it('lists all promo codes', async () => {
    await redbird.promos.create({ code: 'A', type: 'percentage', value: 5 })
    await redbird.promos.create({ code: 'B', type: 'percentage', value: 10 })
    expect(await redbird.promos.list()).toHaveLength(2)
  })

  it('rejects percentage > 100', async () => {
    await expect(
      redbird.promos.create({ code: 'BAD', type: 'percentage', value: 101 }),
    ).rejects.toThrow()
  })

  // ---- validate: percentage ----

  it('validates a 20% code on 100€ → discountAmount 20€', async () => {
    await redbird.promos.create({ code: 'TWENTY', type: 'percentage', value: 20 })
    const result = await redbird.promos.validate('TWENTY', 10000)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.discountAmount).toBe(2000)
  })

  it('validates a fixed 5€ code', async () => {
    await redbird.promos.create({ code: 'FIVE', type: 'fixed', value: 500, currency: 'EUR' })
    const result = await redbird.promos.validate('FIVE', 3000)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.discountAmount).toBe(500)
  })

  it('fixed discount is capped at subtotal', async () => {
    await redbird.promos.create({ code: 'BIG', type: 'fixed', value: 10000, currency: 'EUR' })
    const result = await redbird.promos.validate('BIG', 500)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.discountAmount).toBe(500)
  })

  it('floors fractional cents on percentage', async () => {
    await redbird.promos.create({ code: 'ODD', type: 'percentage', value: 10 })
    // 999 * 10% = 99.9 → floor → 99
    const result = await redbird.promos.validate('ODD', 999)
    if (result.valid) expect(result.discountAmount).toBe(99)
  })

  // ---- validate: rejection reasons ----

  it('rejects unknown code with not_found', async () => {
    const result = await redbird.promos.validate('GHOST', 10000)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('not_found')
  })

  it('rejects inactive code', async () => {
    const promo = await redbird.promos.create({ code: 'INACTIVE', type: 'percentage', value: 10 })
    await redbird.promos.update(promo.id, { active: false })
    const result = await redbird.promos.validate('INACTIVE', 10000)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('inactive')
  })

  it('rejects expired code', async () => {
    await redbird.promos.create({
      code: 'EXPIRED',
      type: 'percentage',
      value: 10,
      expiresAt: new Date(Date.now() - 1000),
    })
    const result = await redbird.promos.validate('EXPIRED', 10000)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('expired')
  })

  it('rejects when max uses reached', async () => {
    await redbird.promos.create({ code: 'ONCE', type: 'percentage', value: 10, maxUses: 1 })
    await redbird.promos.redeem('ONCE')
    const result = await redbird.promos.validate('ONCE', 10000)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('max_uses_reached')
  })

  it('rejects when cart subtotal below minimum', async () => {
    await redbird.promos.create({
      code: 'MIN50',
      type: 'percentage',
      value: 10,
      minimumAmount: 5000,
    })
    const result = await redbird.promos.validate('MIN50', 4999)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('minimum_not_met')
  })

  it('accepts when cart subtotal exactly meets minimum', async () => {
    await redbird.promos.create({
      code: 'EXACT',
      type: 'percentage',
      value: 10,
      minimumAmount: 5000,
    })
    expect((await redbird.promos.validate('EXACT', 5000)).valid).toBe(true)
  })

  // ---- redeem ----

  it('redeem increments usedCount', async () => {
    await redbird.promos.create({ code: 'COUNT', type: 'percentage', value: 10, maxUses: 3 })
    await redbird.promos.redeem('COUNT')
    await redbird.promos.redeem('COUNT')
    const promo = await redbird.promos.get('COUNT')
    expect(promo?.usedCount).toBe(2)
  })

  // ---- delete ----

  it('deletes a promo code', async () => {
    const promo = await redbird.promos.create({ code: 'DEL', type: 'percentage', value: 5 })
    await redbird.promos.delete(promo.id)
    expect(await redbird.promos.get('DEL')).toBeNull()
  })
})
