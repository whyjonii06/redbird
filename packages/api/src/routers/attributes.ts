import { z } from 'zod'
import { adminProcedure, router } from '../trpc.js'

export const attributesRouter = router({
  /** List attributes with values for a product */
  list: adminProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => ctx.redbird.attributes.listAttributes(input.productId)),

  /** Add attribute (e.g. "Color") to a product */
  addAttribute: adminProcedure
    .input(z.object({ productId: z.string().uuid(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      ctx.redbird.attributes.addAttribute(input.productId, input.name),
    ),

  /** Add a value (e.g. "Red") to an attribute */
  addValue: adminProcedure
    .input(z.object({ attributeId: z.string().uuid(), value: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      ctx.redbird.attributes.addValue(input.attributeId, input.value),
    ),

  /** Delete an attribute (and its values) */
  removeAttribute: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => ctx.redbird.attributes.removeAttribute(input.id)),

  /** Delete a specific value */
  removeValue: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => ctx.redbird.attributes.removeValue(input.id)),

  /**
   * Auto-generate all variant combinations from attributes.
   * E.g. Color[Red,Blue] × Size[S,M,L] → 6 variants.
   */
  generateCombinations: adminProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        priceAmount: z.number().int().min(0),
        priceCurrency: z.string().length(3),
        inventoryQuantity: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.redbird.attributes.generateCombinations(input.productId, {
        priceAmount: input.priceAmount,
        priceCurrency: input.priceCurrency,
        inventoryQuantity: input.inventoryQuantity,
      }),
    ),

  /** Get attribute assignments for a variant */
  variantAttributes: adminProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => ctx.redbird.attributes.getVariantAttributes(input.variantId)),
})
