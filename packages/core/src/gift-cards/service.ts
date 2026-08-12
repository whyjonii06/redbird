import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type GiftCard, type NewGiftCard, giftCardTransactions, giftCards } from '../db/schema.js'

export type GiftCardService = {
  create(input: {
    balance: number
    currency: string
    code?: string
    issuedToEmail?: string
    expiresAt?: Date
    orderId?: string
  }): Promise<GiftCard>
  get(code: string): Promise<GiftCard | null>
  getById(id: string): Promise<GiftCard | null>
  validate(
    code: string,
    currency: string,
  ): Promise<
    | { valid: true; balance: number; giftCard: GiftCard }
    | { valid: false; reason: 'not_found' | 'expired' | 'empty' | 'currency_mismatch' }
  >
  redeem(code: string, amount: number, orderId: string): Promise<GiftCard>
  void(id: string): Promise<void>
  list(opts?: { limit?: number }): Promise<GiftCard[]>
}

function generateCode(): string {
  const hex = randomBytes(8).toString('hex').toUpperCase()
  return [hex.slice(0, 4), hex.slice(4, 8), hex.slice(8, 12), hex.slice(12, 16)].join('-')
}

export function createGiftCardService(db: DbClient): GiftCardService {
  return {
    async create({ balance, currency, code, issuedToEmail, expiresAt, orderId }) {
      const row: NewGiftCard = {
        code: code?.trim().toUpperCase() ?? generateCode(),
        initialBalance: balance,
        balance,
        currency: currency.toUpperCase(),
      }
      if (issuedToEmail !== undefined) row.issuedToEmail = issuedToEmail
      if (expiresAt !== undefined) row.expiresAt = expiresAt
      if (orderId !== undefined) row.orderId = orderId
      const [card] = await db.insert(giftCards).values(row).returning()
      if (!card) throw new Error('Failed to create gift card')
      return card
    },

    async get(code) {
      const normalized = code.trim().toUpperCase()
      const row = await db.query.giftCards.findFirst({
        where: (gc, { eq: eqFn }) => eqFn(gc.code, normalized),
      })
      return row ?? null
    },

    async getById(id) {
      const row = await db.query.giftCards.findFirst({
        where: (gc, { eq: eqFn }) => eqFn(gc.id, id),
      })
      return row ?? null
    },

    async validate(code, currency) {
      const card = await this.get(code)
      if (!card) return { valid: false, reason: 'not_found' as const }
      if (card.currency !== currency.toUpperCase())
        return { valid: false, reason: 'currency_mismatch' as const }
      if (card.expiresAt && new Date() > card.expiresAt)
        return { valid: false, reason: 'expired' as const }
      if (card.balance <= 0) return { valid: false, reason: 'empty' as const }
      return { valid: true, balance: card.balance, giftCard: card }
    },

    async redeem(code, amount, orderId) {
      // `FOR UPDATE` locks the row for the transaction's duration so two concurrent
      // redemptions of the same card serialize instead of both reading the same stale
      // balance and both deducting from it (which could drive balance negative).
      return db.transaction(async (tx) => {
        const normalized = code.trim().toUpperCase()
        const [card] = await tx
          .select()
          .from(giftCards)
          .where(eq(giftCards.code, normalized))
          .for('update')
        if (!card) throw new Error('Gift card not found')
        const deducted = Math.min(amount, card.balance)
        const [updated] = await tx
          .update(giftCards)
          .set({ balance: card.balance - deducted, updatedAt: new Date() })
          .where(eq(giftCards.id, card.id))
          .returning()
        if (!updated) throw new Error('Failed to redeem gift card')
        await tx.insert(giftCardTransactions).values({
          giftCardId: card.id,
          orderId,
          amount: -deducted,
          description: `Redeemed on order`,
        })
        return updated
      })
    },

    async void(id) {
      await db
        .update(giftCards)
        .set({ balance: 0, updatedAt: new Date() })
        .where(eq(giftCards.id, id))
    },

    async list({ limit = 50 } = {}) {
      return db.query.giftCards.findMany({
        orderBy: (gc, { desc }) => [desc(gc.createdAt)],
        limit,
      })
    },
  }
}
