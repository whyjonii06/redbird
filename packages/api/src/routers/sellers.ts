import { products } from '@redbirdshop/core/schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { signSellerToken } from '../auth.js'
import { authLimitedProcedure, registerLimitedProcedure, router, sellerProcedure } from '../trpc.js'

export const sellersRouter = router({
  /** New vendor signup — starts in "pending" status until a staff member approves it. */
  register: registerLimitedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        storeName: z.string().min(1),
        contactEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const seller = await ctx.redbird.sellers.register(input)
        return { seller }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Registration failed'
        throw new TRPCError({ code: 'CONFLICT', message: msg })
      }
    }),

  login: authLimitedProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const seller = await ctx.redbird.sellers.login(input.email, input.password)
      if (!seller) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      if (seller.status === 'pending') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your seller account is still awaiting approval.',
        })
      }
      const token = signSellerToken(seller.id, ctx.jwtSecret)
      return { token, seller }
    }),

  me: sellerProcedure.query(async ({ ctx }) => {
    const seller = await ctx.redbird.sellers.get(ctx.sellerId!)
    if (!seller) throw new TRPCError({ code: 'NOT_FOUND' })
    return seller
  }),

  myProducts: router({
    list: sellerProcedure.query(async ({ ctx }) => {
      return ctx.redbird.db.query.products.findMany({
        where: eq(products.sellerId, ctx.sellerId!),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
        with: { variants: { with: { stockLevel: true } }, images: true },
      })
    }),

    create: sellerProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          variant: z.object({
            sku: z.string().min(1),
            name: z.string().min(1),
            priceAmount: z.number().int().min(0),
            priceCurrency: z.string().length(3),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { variant, ...productInput } = input
        // New listings start in "draft" — staff/the seller must publish once
        // ready, same as store-owned products.
        return ctx.redbird.catalog.createProduct(
          {
            ...productInput,
            description: productInput.description ?? null,
            status: 'draft',
            sellerId: ctx.sellerId!,
          },
          [{ ...variant, inventoryQuantity: 0, attributes: {} }],
        )
      }),

    update: sellerProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          status: z.enum(['draft', 'active', 'archived']).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const product = await ctx.redbird.catalog.getProductById(input.id)
        if (!product || product.sellerId !== ctx.sellerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' })
        }
        const patch: Parameters<typeof ctx.redbird.catalog.updateProduct>[1] = {}
        if (input.name !== undefined) patch.name = input.name
        if (input.description !== undefined) patch.description = input.description
        if (input.status !== undefined) patch.status = input.status
        return ctx.redbird.catalog.updateProduct(input.id, patch)
      }),

    delete: sellerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const product = await ctx.redbird.catalog.getProductById(input.id)
        if (!product || product.sellerId !== ctx.sellerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' })
        }
        await ctx.redbird.catalog.deleteProduct(input.id)
        return { ok: true }
      }),

    updateVariant: sellerProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          priceAmount: z.number().int().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const variant = await ctx.redbird.db.query.productVariants.findFirst({
          where: (v, { eq: eqFn }) => eqFn(v.id, input.id),
          with: { product: { columns: { sellerId: true } } },
        })
        if (!variant || variant.product?.sellerId !== ctx.sellerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Variant not found' })
        }
        const patch: Parameters<typeof ctx.redbird.catalog.updateVariant>[1] = {}
        if (input.priceAmount !== undefined) patch.priceAmount = input.priceAmount
        return ctx.redbird.catalog.updateVariant(input.id, patch)
      }),

    setStock: sellerProcedure
      .input(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(0) }))
      .mutation(async ({ ctx, input }) => {
        const variant = await ctx.redbird.db.query.productVariants.findFirst({
          where: (v, { eq: eqFn }) => eqFn(v.id, input.variantId),
          with: { product: { columns: { sellerId: true } } },
        })
        if (!variant || variant.product?.sellerId !== ctx.sellerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Variant not found' })
        }
        return ctx.redbird.stock.set(input.variantId, input.quantity)
      }),
  }),

  myOrders: sellerProcedure.query(async ({ ctx }) => {
    return ctx.redbird.sellers.listOrders(ctx.sellerId!)
  }),

  myEarnings: sellerProcedure.query(async ({ ctx }) => {
    return ctx.redbird.sellers.listEarnings(ctx.sellerId!)
  }),
})
