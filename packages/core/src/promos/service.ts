import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type PromoCode, promoCodes } from '../db/schema.js'

export type PromoType = 'percentage' | 'fixed' | 'bogo' | 'tiered'

export type PromoBogoConfig = {
  /** Units that must be in the cart per "group" for the offer to apply. */
  buyQuantity: number
  /** Units discounted per group, on top of buyQuantity. */
  getQuantity: number
  /** Percentage off each discounted unit — 100 = free. */
  getDiscountPercent: number
}

export type PromoTier = { minQuantity: number; discountPercent: number }

export type PromoLineItem = { unitPriceAmount: number; quantity: number }

export type CreatePromoInput = {
  code: string
  type: PromoType
  /** Percentage 1–100, or fixed amount in smallest currency unit. Ignored for bogo/tiered. */
  value: number
  /** Required for fixed discounts. */
  currency?: string | undefined
  minimumAmount?: number | undefined
  maxUses?: number | undefined
  expiresAt?: Date | undefined
  /** Required when type = 'bogo'. */
  bogoConfig?: PromoBogoConfig | undefined
  /** Required when type = 'tiered'. */
  tiers?: PromoTier[] | undefined
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
      reason:
        | 'not_found'
        | 'inactive'
        | 'expired'
        | 'max_uses_reached'
        | 'minimum_not_met'
        | 'line_items_required'
    }

export type UpdatePromoInput = {
  type?: PromoType
  value?: number
  currency?: string
  minimumAmount?: number | null
  maxUses?: number | null
  expiresAt?: Date | null
  active?: boolean
  bogoConfig?: PromoBogoConfig | null
  tiers?: PromoTier[] | null
}

export type PromoService = {
  create(input: CreatePromoInput): Promise<PromoCode>
  get(code: string): Promise<PromoCode | null>
  list(): Promise<PromoCode[]>
  update(id: string, patch: UpdatePromoInput): Promise<PromoCode>
  delete(id: string): Promise<void>
  /**
   * Validate a promo code against a cart subtotal. `lineItems` is required for
   * bogo/tiered types (they discount specific units / key off total quantity,
   * not just the subtotal) — omit it for plain percentage/fixed codes.
   * Does NOT increment usedCount — call redeem() after order creation.
   */
  validate(
    code: string,
    subtotalAmount: number,
    lineItems?: PromoLineItem[],
  ): Promise<PromoValidation>
  /** Increment usedCount. Call once per successful order. */
  redeem(code: string): Promise<void>
}

/**
 * BOGO discount: the N cheapest units in the cart are discounted, where N is
 * however many "get" slots the cart's total quantity earns. Discounting the
 * cheapest units (not an arbitrary line) is the customer-favorable, standard
 * reading of "buy X get Y" and isn't gameable by ordering priciest items first.
 */
function computeBogoDiscount(config: PromoBogoConfig, lineItems: PromoLineItem[]): number {
  const groupSize = config.buyQuantity + config.getQuantity
  if (groupSize <= 0 || config.getQuantity <= 0) return 0

  const unitPrices = lineItems.flatMap((li) => Array(li.quantity).fill(li.unitPriceAmount))
  const totalQty = unitPrices.length
  const groups = Math.floor(totalQty / groupSize)
  const discountedUnits = groups * config.getQuantity
  if (discountedUnits <= 0) return 0

  unitPrices.sort((a, b) => a - b)
  const cheapest = unitPrices.slice(0, discountedUnits)
  const sum = cheapest.reduce((acc, p) => acc + p, 0)
  return Math.floor((sum * config.getDiscountPercent) / 100)
}

/** Highest tier whose minQuantity the cart's total quantity meets, or none. */
function computeTieredDiscount(
  tiers: PromoTier[],
  subtotalAmount: number,
  lineItems: PromoLineItem[],
): number {
  const totalQty = lineItems.reduce((sum, li) => sum + li.quantity, 0)
  const applicable = tiers
    .filter((t) => totalQty >= t.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0]
  if (!applicable) return 0
  return Math.floor((subtotalAmount * applicable.discountPercent) / 100)
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
      if (input.type === 'bogo') {
        const c = input.bogoConfig
        if (!c || c.buyQuantity < 1 || c.getQuantity < 1) {
          throw new Error('bogoConfig with buyQuantity >= 1 and getQuantity >= 1 is required')
        }
        if (c.getDiscountPercent < 1 || c.getDiscountPercent > 100) {
          throw new Error('bogoConfig.getDiscountPercent must be between 1 and 100')
        }
      }
      if (input.type === 'tiered') {
        if (!input.tiers || input.tiers.length === 0) {
          throw new Error('At least one tier is required')
        }
        for (const t of input.tiers) {
          if (t.minQuantity < 1 || t.discountPercent < 1 || t.discountPercent > 100) {
            throw new Error(
              'Each tier needs minQuantity >= 1 and discountPercent between 1 and 100',
            )
          }
        }
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
          bogoConfig: input.bogoConfig ?? null,
          tiers: input.tiers ?? null,
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
      if (patch.bogoConfig !== undefined) setValues.bogoConfig = patch.bogoConfig ?? null
      if (patch.tiers !== undefined) setValues.tiers = patch.tiers ?? null
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

    async validate(code, subtotalAmount, lineItems) {
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

      let items: PromoLineItem[] | undefined
      if (promo.type === 'bogo' || promo.type === 'tiered') {
        if (!lineItems || lineItems.length === 0) {
          return { valid: false, reason: 'line_items_required' }
        }
        items = lineItems
        if (promo.type === 'tiered' && promo.tiers) {
          const totalQty = items.reduce((sum, li) => sum + li.quantity, 0)
          const lowestTier = Math.min(...promo.tiers.map((t) => t.minQuantity))
          if (totalQty < lowestTier) {
            return { valid: false, reason: 'minimum_not_met' }
          }
        }
      }

      const discountAmount =
        promo.type === 'percentage'
          ? Math.floor((subtotalAmount * promo.value) / 100)
          : promo.type === 'fixed'
            ? Math.min(promo.value, subtotalAmount)
            : promo.type === 'bogo'
              ? computeBogoDiscount(promo.bogoConfig as PromoBogoConfig, items ?? [])
              : computeTieredDiscount(promo.tiers as PromoTier[], subtotalAmount, items ?? [])

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
