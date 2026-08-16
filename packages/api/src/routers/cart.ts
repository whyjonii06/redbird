import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { addressSchema } from '../address-schema.js'
import { protectedProcedure, publicProcedure, router } from '../trpc.js'

const cartIdInput = z.object({ cartId: z.string().uuid() })

export const cartRouter = router({
  create: publicProcedure
    .input(
      z.object({
        currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be ISO 4217'),
        customerId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.cart.create({ ...input, tenantId: ctx.tenantId })
    }),

  get: publicProcedure.input(cartIdInput).query(async ({ ctx, input }) => {
    const cart = await ctx.redbird.cart.get(input.cartId)
    if (!cart) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cart not found' })
    return cart
  }),

  subtotal: publicProcedure.input(cartIdInput).query(async ({ ctx, input }) => {
    return ctx.redbird.cart.subtotal(input.cartId)
  }),

  addItem: publicProcedure
    .input(
      cartIdInput.extend({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.cart.addItem(input.cartId, input.variantId, input.quantity)
    }),

  removeItem: publicProcedure
    .input(cartIdInput.extend({ lineItemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.redbird.cart.removeItem(input.cartId, input.lineItemId)
      return { ok: true }
    }),

  updateQuantity: publicProcedure
    .input(
      cartIdInput.extend({
        lineItemId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.cart.updateItemQuantity(input.cartId, input.lineItemId, input.quantity)
    }),

  clear: publicProcedure.input(cartIdInput).mutation(async ({ ctx, input }) => {
    await ctx.redbird.cart.clear(input.cartId)
    return { ok: true }
  }),

  setShippingAddress: publicProcedure
    .input(cartIdInput.extend({ address: addressSchema }))
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.cart.setShippingAddress(input.cartId, input.address)
    }),

  setEmail: publicProcedure
    .input(cartIdInput.extend({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.redbird.cart.setEmail(input.cartId, input.email)
    }),

  /** Attach a guest cart to the now-authenticated customer, right after login/register. */
  claim: protectedProcedure.input(cartIdInput).mutation(async ({ ctx, input }) => {
    const customer = await ctx.redbird.customers.get(ctx.customerId)
    if (!customer) throw new TRPCError({ code: 'UNAUTHORIZED' })
    return ctx.redbird.cart.claim(input.cartId, ctx.customerId, customer.email)
  }),
})
