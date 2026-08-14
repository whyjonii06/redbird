import { productVariants } from '@redbirdshop/core/schema'
import { TRPCError } from '@trpc/server'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { publicProcedure, router } from '../trpc.js'

const localeInput = z.string().min(2).max(10).optional()

export const catalogRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          status: z.enum(['draft', 'active', 'archived']).optional(),
          sortBy: z.enum(['newest', 'price_asc', 'price_desc', 'name']).optional(),
          inStock: z.boolean().optional(),
          locale: localeInput,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const products = await ctx.redbird.catalog.listProducts({
        limit: input?.limit,
        offset: input?.offset,
        status: input?.status,
        sortBy: input?.sortBy,
      })
      let result = input?.locale
        ? products.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : products

      if (input?.inStock) {
        result = result.filter((p) =>
          p.variants.some((v) => v.stockLevel === null || v.stockLevel.available > 0),
        )
      }

      if (input?.sortBy === 'price_asc') {
        result = [...result].sort(
          (a, b) =>
            Math.min(...a.variants.map((v) => v.priceAmount)) -
            Math.min(...b.variants.map((v) => v.priceAmount)),
        )
      } else if (input?.sortBy === 'price_desc') {
        result = [...result].sort(
          (a, b) =>
            Math.min(...b.variants.map((v) => v.priceAmount)) -
            Math.min(...a.variants.map((v) => v.priceAmount)),
        )
      }

      return result
    }),

  search: publicProcedure
    .input(
      z.object({
        q: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
        status: z.enum(['draft', 'active', 'archived']).default('active'),
        locale: localeInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.redbird.catalog.search(input.q, {
        limit: input.limit,
        status: input.status,
      })
      return input.locale
        ? results.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : results
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1), locale: localeInput }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.redbird.catalog.getProductBySlug(input.slug)
      if (!product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Product "${input.slug}" not found` })
      }
      return input.locale ? ctx.redbird.i18n.translate(product, input.locale) : product
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), locale: localeInput }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.redbird.catalog.getProductById(input.id)
      if (!product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Product ${input.id} not found` })
      }
      return input.locale ? ctx.redbird.i18n.translate(product, input.locale) : product
    }),

  related: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        type: z.enum(['related', 'upsell', 'cross_sell']).optional(),
        limit: z.number().int().min(1).max(20).default(4),
        locale: localeInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const rels = await ctx.redbird.catalog.listRelations(
        input.productId,
        input.type ? { type: input.type } : {},
      )
      const related = rels
        .slice(0, input.limit)
        .map((r) => r.relatedProduct)
        .filter((p): p is NonNullable<typeof p> => p !== null && p.status === 'active')
      return input.locale
        ? related.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : related
    }),

  /**
   * Data-driven "customers also bought": products that co-occur with
   * `productId` across past orders, ranked by number of distinct orders
   * they were bought together in. Unlike `related`, this needs no manual
   * curation — it's computed straight from order history.
   */
  alsoBought: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        limit: z.number().int().min(1).max(20).default(4),
        locale: localeInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const sourceProduct = await ctx.redbird.catalog.getProductById(input.productId)
      if (!sourceProduct || sourceProduct.variants.length === 0) return []
      const sourceVariantIds = new Set(sourceProduct.variants.map((v) => v.id))

      const lineItems = await ctx.redbird.db.query.orderLineItems.findMany({
        columns: { orderId: true, variantId: true },
      })

      const ordersWithProduct = new Set(
        lineItems
          .filter((li) => li.variantId && sourceVariantIds.has(li.variantId))
          .map((li) => li.orderId),
      )
      if (ordersWithProduct.size === 0) return []

      // Count each co-occurring variant once per order (not once per line item).
      const seenPerOrder = new Set<string>()
      const coCount = new Map<string, number>()
      for (const li of lineItems) {
        if (!li.variantId || sourceVariantIds.has(li.variantId)) continue
        if (!ordersWithProduct.has(li.orderId)) continue
        const key = `${li.orderId}:${li.variantId}`
        if (seenPerOrder.has(key)) continue
        seenPerOrder.add(key)
        coCount.set(li.variantId, (coCount.get(li.variantId) ?? 0) + 1)
      }
      if (coCount.size === 0) return []

      const variants = await ctx.redbird.db.query.productVariants.findMany({
        where: inArray(productVariants.id, [...coCount.keys()]),
        columns: { id: true, productId: true },
      })
      const productScore = new Map<string, number>()
      for (const v of variants) {
        const score = coCount.get(v.id) ?? 0
        productScore.set(v.productId, (productScore.get(v.productId) ?? 0) + score)
      }
      productScore.delete(input.productId)

      const topIds = [...productScore.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, input.limit)
        .map(([id]) => id)
      if (topIds.length === 0) return []

      const products = await ctx.redbird.catalog.listProducts({ limit: 10000, status: 'active' })
      const byId = new Map(products.map((p) => [p.id, p]))
      const result = topIds
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)

      return input.locale
        ? result.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : result
    }),

  filter: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).optional(),
        categoryId: z.string().uuid().optional(),
        brandIds: z.array(z.string().uuid()).optional(),
        attributeValueIds: z.array(z.string().uuid()).optional(),
        minPrice: z.number().int().min(0).optional(),
        maxPrice: z.number().int().min(0).optional(),
        inStock: z.boolean().optional(),
        q: z.string().optional(),
        sortBy: z.enum(['newest', 'price_asc', 'price_desc', 'name']).optional(),
        limit: z.number().int().min(1).max(100).default(12),
        offset: z.number().int().min(0).default(0),
        locale: localeInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Load base set (all matching products, pre-pagination)
      let base: Awaited<ReturnType<typeof ctx.redbird.catalog.listProducts>>

      if (input.categoryId) {
        base = await ctx.redbird.categories.listProducts(input.categoryId, {
          limit: 10000,
          offset: 0,
        })
      } else if (input.q?.trim()) {
        base = await ctx.redbird.catalog.search(input.q.trim(), {
          limit: 10000,
          status: 'active',
        })
      } else {
        base = await ctx.redbird.catalog.listProducts({ limit: 10000, status: 'active' })
      }

      // 2. Apply inStock early (affects facet counts)
      if (input.inStock) {
        base = base.filter((p) =>
          p.variants.some((v) => v.stockLevel === null || v.stockLevel.available > 0),
        )
      }

      // 3. Compute facets from this base (before brand/price/attribute filters)
      const brandMap = new Map<string, { id: string; name: string; count: number }>()
      const attributeMap = new Map<
        string,
        { name: string; values: Map<string, { id: string; value: string; count: number }> }
      >()
      let minP = Number.POSITIVE_INFINITY
      let maxP = Number.NEGATIVE_INFINITY
      for (const p of base) {
        if (p.brand && p.brandId) {
          const entry = brandMap.get(p.brandId)
          if (entry) entry.count++
          else brandMap.set(p.brandId, { id: p.brand.id, name: p.brand.name, count: 1 })
        }
        for (const v of p.variants) {
          if (v.priceAmount < minP) minP = v.priceAmount
          if (v.priceAmount > maxP) maxP = v.priceAmount
          for (const av of v.attributeValues ?? []) {
            const attr = av.attributeValue?.attribute
            if (!attr) continue
            if (!attributeMap.has(attr.id)) {
              attributeMap.set(attr.id, { name: attr.name, values: new Map() })
            }
            const attrEntry = attributeMap.get(attr.id)!
            if (!attrEntry.values.has(av.attributeValueId)) {
              attrEntry.values.set(av.attributeValueId, {
                id: av.attributeValueId,
                value: av.attributeValue!.value,
                count: 0,
              })
            }
            attrEntry.values.get(av.attributeValueId)!.count++
          }
        }
      }

      // 4. Apply brand + price + attribute + ids filters for the final result
      let filtered = base

      if (input.ids?.length) {
        const idSet = new Set(input.ids)
        filtered = filtered.filter((p) => idSet.has(p.id))
      }
      if (input.brandIds?.length) {
        const ids = new Set(input.brandIds)
        filtered = filtered.filter((p) => p.brandId !== null && ids.has(p.brandId ?? ''))
      }
      if (input.minPrice !== undefined) {
        const min = input.minPrice
        filtered = filtered.filter((p) => p.variants.some((v) => v.priceAmount >= min))
      }
      if (input.maxPrice !== undefined) {
        const max = input.maxPrice
        filtered = filtered.filter((p) => p.variants.some((v) => v.priceAmount <= max))
      }
      if (input.attributeValueIds?.length) {
        const ids = new Set(input.attributeValueIds)
        filtered = filtered.filter((p) =>
          p.variants.some((v) =>
            (v.attributeValues ?? []).some((av) => ids.has(av.attributeValueId)),
          ),
        )
      }

      // 5. Sort
      if (input.sortBy === 'price_asc') {
        filtered = [...filtered].sort(
          (a, b) =>
            Math.min(...a.variants.map((v) => v.priceAmount)) -
            Math.min(...b.variants.map((v) => v.priceAmount)),
        )
      } else if (input.sortBy === 'price_desc') {
        filtered = [...filtered].sort(
          (a, b) =>
            Math.min(...b.variants.map((v) => v.priceAmount)) -
            Math.min(...a.variants.map((v) => v.priceAmount)),
        )
      } else if (input.sortBy === 'name') {
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
      }

      const totalCount = filtered.length
      const page = filtered.slice(input.offset, input.offset + input.limit)
      const products = input.locale
        ? page.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : page

      return {
        products,
        totalCount,
        facets: {
          brands: [...brandMap.values()].sort((a, b) => b.count - a.count),
          priceRange: {
            min: Number.isFinite(minP) ? minP : 0,
            max: Number.isFinite(maxP) ? maxP : 0,
          },
          attributes: [...attributeMap.entries()].map(([id, { name, values }]) => ({
            id,
            name,
            values: [...values.values()].sort((a, b) => b.count - a.count),
          })),
        },
      }
    }),
})

export const categoriesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({ parentId: z.string().uuid().nullable().optional(), locale: localeInput })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const cats = await ctx.redbird.categories.list(input ?? {})
      return input?.locale
        ? cats.map((c) => ctx.redbird.categoryI18n.translate(c, input.locale as string))
        : cats
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1), locale: localeInput }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.redbird.categories.getBySlug(input.slug)
      if (!category) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Category "${input.slug}" not found` })
      }
      return input.locale ? ctx.redbird.categoryI18n.translate(category, input.locale) : category
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), locale: localeInput }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.redbird.categories.getById(input.id)
      if (!category) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Category ${input.id} not found` })
      }
      return input.locale ? ctx.redbird.categoryI18n.translate(category, input.locale) : category
    }),

  products: publicProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        locale: localeInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      const products = await ctx.redbird.categories.listProducts(input.categoryId, {
        limit: input.limit,
        offset: input.offset,
      })
      return input.locale
        ? products.map((p) => ctx.redbird.i18n.translate(p, input.locale as string))
        : products
    }),
})

export const brandsRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.redbird.brands.list()),
  get: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const brand = await ctx.redbird.brands.get(input.id)
    if (!brand) throw new TRPCError({ code: 'NOT_FOUND', message: 'Brand not found' })
    return brand
  }),
})
