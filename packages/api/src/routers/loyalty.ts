import { z } from 'zod'
import { adminProcedure, protectedProcedure, publicProcedure, router } from '../trpc.js'

export const loyaltyRouter = router({
  myAccount: protectedProcedure.query(async ({ ctx }) => {
    const [account, txs] = await Promise.all([
      ctx.redbird.loyalty.getOrCreateAccount(ctx.customerId!),
      ctx.redbird.loyalty.getTransactions(ctx.customerId!, { limit: 20 }),
    ])
    const cfg = ctx.redbird.loyaltyConfig
    return {
      balance: account.balance,
      redeemRate: cfg.redeemRate,
      earnRate: cfg.earnRate,
      enabled: cfg.enabled,
      transactions: txs,
    }
  }),

  preview: publicProcedure
    .input(z.object({ points: z.number().int().min(1) }))
    .query(({ ctx, input }) => {
      const redeemRate = ctx.redbird.loyaltyConfig.redeemRate
      return { cents: ctx.redbird.loyalty.previewRedeem(input.points, redeemRate) }
    }),
})

export const adminLoyaltyRouter = router({
  listAccounts: adminProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.redbird.db.query.loyaltyAccounts.findMany({
      orderBy: (t, { desc }) => [desc(t.balance)],
      limit: 200,
    })
    // Enrich with customer email
    const customerIds = accounts.map((a) => a.customerId)
    const customers =
      customerIds.length > 0
        ? await ctx.redbird.db.query.customers.findMany({
            columns: { id: true, email: true, firstName: true, lastName: true },
          })
        : []
    const byId = new Map(customers.map((c) => [c.id, c]))
    return accounts.map((a) => ({ ...a, customer: byId.get(a.customerId) ?? null }))
  }),

  adjust: adminProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        points: z.number().int(),
        description: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.loyalty.adjust(input.customerId, input.points, input.description)
    }),

  getAccount: adminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [balance, txs] = await Promise.all([
        ctx.redbird.loyalty.getBalance(input.customerId),
        ctx.redbird.loyalty.getTransactions(input.customerId, { limit: 50 }),
      ])
      return { balance, transactions: txs }
    }),
})
