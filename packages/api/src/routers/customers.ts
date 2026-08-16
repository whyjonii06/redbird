import { wishlists } from '@redbirdshop/core/schema'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { signToken } from '../auth.js'
import {
  authLimitedProcedure,
  protectedProcedure,
  publicProcedure,
  registerLimitedProcedure,
  router,
} from '../trpc.js'

export const customersRouter = router({
  register: registerLimitedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const customer = await ctx.redbird.customers.register({
          ...input,
          tenantId: ctx.tenantId,
        })
        const token = signToken(customer.id, ctx.jwtSecret)
        return { customer, token }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Registration failed'
        if (msg.includes('already registered')) {
          throw new TRPCError({ code: 'CONFLICT', message: msg })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg })
      }
    }),

  login: authLimitedProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.redbird.customers.login(input.email, input.password)
      if (!customer) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      const token = signToken(customer.id, ctx.jwtSecret)
      return { customer, token }
    }),

  /** Fetch any customer by ID — intended for admin use. */
  get: publicProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.redbird.customers.get(input.customerId)
      if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      return customer
    }),

  /** Fetch the currently authenticated customer's profile. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const customer = await ctx.redbird.customers.get(ctx.customerId)
    if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
    return customer
  }),

  /** Update the currently authenticated customer's profile. */
  update: protectedProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        marketingOptIn: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.redbird.customers.update(ctx.customerId, input)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed'
        if (msg.includes('not found')) throw new TRPCError({ code: 'NOT_FOUND', message: msg })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg })
      }
    }),

  /**
   * Request a password reset email. Always returns success to prevent enumeration.
   * Requires an email provider to be configured to actually send the email.
   */
  forgotPassword: authLimitedProcedure
    .input(
      z.object({
        email: z.string().email(),
        storeUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.redbird.customers.createResetToken(input.email)
      if (result) {
        const provider = ctx.redbird.email.default()
        if (provider) {
          const storeUrl = input.storeUrl ?? 'http://localhost:5173'
          const storeName = ctx.redbird.config.storeName ?? 'Store'
          const resetLink = `${storeUrl}/reset-password?token=${result.token}`
          await provider.send({
            to: input.email,
            subject: `Reset your password — ${storeName}`,
            html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request a password reset, you can ignore this email.</p>`,
            text: `Reset your password: ${resetLink}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email.`,
          })
        }
      }
      return { success: true }
    }),

  /** Reset password using a token from the reset email. */
  resetPassword: authLimitedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.redbird.customers.resetPassword(input.token, input.newPassword)
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Reset failed'
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg })
      }
    }),

  /** One-click unsubscribe from marketing emails via the link token. No auth required. */
  unsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const ok = await ctx.redbird.campaigns.unsubscribe(input.token)
      return { success: ok }
    }),

  /** GDPR — export all personal data for the current customer as JSON. */
  exportData: protectedProcedure.query(async ({ ctx }) => {
    return ctx.redbird.customers.exportData(ctx.customerId)
  }),

  /** GDPR — anonymise the account (right to erasure). Invalidates the session. */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.redbird.customers.deleteAccount(ctx.customerId)
    return { success: true }
  }),

  /**
   * B2B quantity-tier pricing table for a product, for the currently
   * authenticated customer — empty if they're not in a group with rules for
   * any of the product's variants (the normal case for retail customers).
   */
  tierPricing: protectedProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.redbird.catalog.getProductById(input.productId)
      if (!product) return []
      const results = await Promise.all(
        product.variants.map(async (v) => ({
          variantId: v.id,
          sku: v.sku,
          tiers: await ctx.redbird.customerGroupsSvc.listApplicableTiers(ctx.customerId, v.id),
        })),
      )
      return results.filter((r) => r.tiers.length > 0)
    }),

  /** List orders for the currently authenticated customer. */
  orders: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['pending', 'paid', 'fulfilled', 'cancelled', 'refunded']).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.redbird.orders.list({ customerId: ctx.customerId, ...input })
    }),

  /**
   * One-click reorder of a past order. Rebuilds a cart from its line items
   * at current prices/stock; if the customer has a default saved payment
   * method, charges it immediately and returns the new paid order —
   * otherwise returns a cart id for the client to send through normal
   * checkout instead.
   */
  reorder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.redbird.orders.reorder(input.orderId, ctx.customerId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not reorder'
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg })
      }
    }),

  wishlist: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.customerId) return []
      const rows = await ctx.redbird.db.query.wishlists.findMany({
        where: eq(wishlists.customerId, ctx.customerId),
        with: { product: { with: { variants: true, images: true } } },
        orderBy: (w, { desc }) => [desc(w.createdAt)],
      })
      return rows.map((r) => r.product).filter((p): p is NonNullable<typeof p> => p !== null)
    }),

    add: publicProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.customerId) throw new TRPCError({ code: 'UNAUTHORIZED' })
        await ctx.redbird.db
          .insert(wishlists)
          .values({ customerId: ctx.customerId, productId: input.productId })
          .onConflictDoNothing()
        return { ok: true }
      }),

    remove: publicProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.customerId) throw new TRPCError({ code: 'UNAUTHORIZED' })
        await ctx.redbird.db
          .delete(wishlists)
          .where(
            and(eq(wishlists.customerId, ctx.customerId), eq(wishlists.productId, input.productId)),
          )
        return { ok: true }
      }),
  }),
})
