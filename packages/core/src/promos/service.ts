import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type PromoCode, promoCodes } from '../db/schema.js'

export type CreatePromoInput = {
  code: string
  type: 'percentage' | 'fixed'
  /** Percentage 1–100, or fixed amount in smallest currency unit. */
  value: number
  /** Required for fixed discounts. */
  currency?: string | undefined
  minimumAmount?: number | undefined
  maxUses?: number | undefined
  expiresAt?: Date | undefined
}

export type PromoValidation =
  | {
      valid: true
      promo: PromoCode
      /** Discount amount in smallest currency unit. */
      discountAmount: number
    }
  | {
      valid: false
      reason: 'not_found' | 'inactive' | 'expired' | 'max_uses_reached' | 'minimum_not_met'
    }

export type UpdatePromoInput = {
  type?: 'percentage' | 'fixed'
  value?: number
  currency?: string
  minimumAmount?: number | null
  maxUses?: number | null
  expiresAt?: Date | null
  active?: boolean
}

export type PromoService = {
  create(input: CreatePromoInput): Promise<PromoCode>
  get(code: string): Promise<PromoCode | null>
  list(): Promise<PromoCode[]>
  update(id: string, patch: UpdatePromoInput): Promise<PromoCode>
  delete(id: string): Promise<void>
  /**
   * Validate a promo code against a cart subtotal.
   * Does NOT increment usedCount — call redeem() after order creation.
   */
  validate(code: string, subtotalAmount: number): Promise<PromoValidation>
  /** Increment usedCount. Call once per successful order. */
  redeem(code: string): Promise<void>
}

export function createPromoService(db: DbClient): PromoService {
  return {
    async create(input) {
      if (input.type === 'percentage' && (input.value < 1 || input.value > 100)) {
        throw new Error('Percentage discount must be between 1 and 100')
      }
      if (input.type === 'fixed' && input.value < 1) {
        throw new Error('Fixed discount must be at least 1')
      }
      const [promo] = await db
        .insert(promoCodes)
        .values({
          code: input.code.toUpperCase().trim(),
          type: input.type,
          value: input.value,
          currency: input.currency ?? null,
          minimumAmount: input.minimumAmount ?? null,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ?? null,
        })
        .returning()
      if (!promo) throw new Error('Failed to create promo code')
      return promo
    },

    async get(code) {
      const row = await db.query.promoCodes.findFirst({
        where: eq(promoCodes.code, code.toUpperCase().trim()),
      })
      return row ?? null
    },

    async list() {
      return db.query.promoCodes.findMany({
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      })
    },

    async update(id, patch) {
      const setValues: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.type !== undefined) setValues.type = patch.type
      if (patch.value !== undefined) setValues.value = patch.value
      if (patch.currency !== undefined) setValues.currency = patch.currency ?? null
      if (patch.minimumAmount !== undefined) setValues.minimumAmount = patch.minimumAmount ?? null
      if (patch.maxUses !== undefined) setValues.maxUses = patch.maxUses ?? null
      if (patch.expiresAt !== undefined) setValues.expiresAt = patch.expiresAt ?? null
      if (patch.active !== undefined) setValues.active = patch.active
      const [promo] = await db
        .update(promoCodes)
        .set(setValues)
        .where(eq(promoCodes.id, id))
        .returning()
      if (!promo) throw new Error(`Promo ${id} not found`)
      return promo
    },

    async delete(id) {
      const deleted = await db.delete(promoCodes).where(eq(promoCodes.id, id)).returning()
      if (deleted.length === 0) throw new Error(`Promo ${id} not found`)
    },

    async validate(code, subtotalAmount) {
      const promo = await db.query.promoCodes.findFirst({
        where: eq(promoCodes.code, code.toUpperCase().trim()),
      })
      if (!promo) return { valid: false, reason: 'not_found' }
      if (!promo.active) return { valid: false, reason: 'inactive' }
      if (promo.expiresAt && promo.expiresAt < new Date())
        return { valid: false, reason: 'expired' }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        return { valid: false, reason: 'max_uses_reached' }
      }
      if (promo.minimumAmount !== null && subtotalAmount < promo.minimumAmount) {
        return { valid: false, reason: 'minimum_not_met' }
      }

      const discountAmount =
        promo.type === 'percentage'
          ? Math.floor((subtotalAmount * promo.value) / 100)
          : Math.min(promo.value, subtotalAmount)

      return { valid: true, promo, discountAmount }
    },

    async redeem(code) {
      // Atomic, conditional increment — the WHERE re-checks maxUses at write time so
      // two concurrent redemptions of the last remaining use can't both succeed
      // (validate() alone is a read that two racing requests can both pass).
      const [updated] = await db
        .update(promoCodes)
        .set({ usedCount: sql`${promoCodes.usedCount} + 1`, updatedAt: new Date() })
        .where(
          and(
            eq(promoCodes.code, code.toUpperCase().trim()),
            or(isNull(promoCodes.maxUses), lt(promoCodes.usedCount, promoCodes.maxUses)),
          ),
        )
        .returning()
      if (!updated) {
        throw new Error(
          `Promo code ${code} could not be redeemed (not found or usage limit reached)`,
        )
      }
    },
  }
}
