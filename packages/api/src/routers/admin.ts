import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type FecEntry, generateFec } from '@redbirdshop/core'
import { carts, storeSettings } from '@redbirdshop/core/schema'
import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import {
  adminProcedure,
  ownerProcedure,
  router,
  staffProcedure,
  warehouseProcedure,
} from '../trpc.js'

export type NavItem = {
  id: string
  label: string
  type: 'category' | 'page' | 'custom'
  value: string
  children?: Omit<NavItem, 'children'>[]
}
// Reviews data layer — loaded lazily so the API can be published without the
// `@redbird/plugin-reviews` module installed.
const reviewsPlugin = () => import('@redbird/plugin-reviews')
import { adminLoyaltyRouter } from './loyalty.js'

/** Catalog of sellable storefront themes (full Next.js storefronts). */
const STOREFRONT_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean, conversion-focused DTC storefront. A great free starting point.',
    plan: 'free' as const,
    priceEur: 0,
    accent: '#4f46e5',
    pkg: '@redbird/storefront-classic',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine-style, content-led storefront with warm serif typography.',
    plan: 'pro' as const,
    priceEur: 49,
    accent: '#b3552c',
    pkg: '@redbird/storefront-editorial',
  },
  {
    id: 'b2b',
    name: 'B2B Wholesale',
    description: 'Dense catalog, quote-ready layout tuned for wholesale buyers.',
    plan: 'pro' as const,
    priceEur: 79,
    accent: '#334155',
    pkg: '@redbird/storefront-b2b',
  },
]

export const adminRouter = router({
  // ---- Config (read-only view of server config) ----
  config: router({
    get: adminProcedure.query(({ ctx }) => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      return {
        storeName: ctx.redbird.config.storeName ?? '',
        defaultCurrency: ctx.redbird.config.defaultCurrency,
        defaultPaymentProvider: ctx.redbird.config.defaultPaymentProvider ?? null,
        defaultEmailProvider: ctx.redbird.config.defaultEmailProvider ?? null,
        theme: (meta.theme as 'classic' | 'editorial' | 'minimal') ?? 'classic',
        priceDisplay: (meta.priceDisplay as 'incl_tax' | 'excl_tax' | 'none') ?? 'none',
        branding:
          (meta.branding as
            | {
                primaryColor?: string
                tagline?: string
                logoUrl?: string
                bgColor?: string
                surfaceColor?: string
                textColor?: string
                mutedColor?: string
                borderColor?: string
                fontHeading?: string
                fontBody?: string
                radius?: string
              }
            | undefined) ?? {},
        stockAlertEmail:
          (meta.stockAlertEmail as string | undefined) ?? ctx.redbird.stockAlertConfig.email ?? '',
        stockAlertThreshold:
          (meta.stockAlertThreshold as number | undefined) ??
          ctx.redbird.stockAlertConfig.threshold,
        licenseKey: (meta.licenseKey as string | undefined) ?? '',
        unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? '',
        seller:
          (meta.seller as import('@redbirdshop/core').SellerConfig | undefined) ??
          ctx.redbird.config.seller ??
          null,
      }
    }),

    update: adminProcedure
      .input(
        z.object({
          theme: z.enum(['classic', 'editorial', 'lookbook', 'minimal']).optional(),
          priceDisplay: z.enum(['incl_tax', 'excl_tax', 'none']).optional(),
          storeName: z.string().optional(),
          branding: z
            .object({
              primaryColor: z.string().optional(),
              tagline: z.string().optional(),
              logoUrl: z.string().optional(),
              // Design tokens (no-code theming)
              bgColor: z.string().optional(),
              surfaceColor: z.string().optional(),
              textColor: z.string().optional(),
              mutedColor: z.string().optional(),
              borderColor: z.string().optional(),
              fontHeading: z.string().optional(),
              fontBody: z.string().optional(),
              radius: z.string().optional(),
            })
            .optional(),
          stockAlertEmail: z.string().optional(),
          stockAlertThreshold: z.number().int().min(0).optional(),
          licenseKey: z.string().optional(),
          seller: z
            .object({
              name: z.string(),
              address: z.object({
                line1: z.string(),
                line2: z.string().optional(),
                postalCode: z.string(),
                city: z.string(),
                countryCode: z.string(),
              }),
              vatNumber: z.string().optional(),
              legalRegistrationId: z.string().optional(),
              email: z.string().optional(),
            })
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let current: Record<string, unknown> = {}
        try {
          current = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const updated = { ...current }
        if (input.theme !== undefined) updated.theme = input.theme
        if (input.priceDisplay !== undefined) updated.priceDisplay = input.priceDisplay
        if (input.storeName !== undefined) updated.storeName = input.storeName
        if (input.seller !== undefined) updated.seller = input.seller
        if (input.branding !== undefined) {
          updated.branding = { ...((current.branding as object) ?? {}), ...input.branding }
        }
        if (input.stockAlertEmail !== undefined) {
          updated.stockAlertEmail = input.stockAlertEmail
          ctx.redbird.stockAlertConfig.email = input.stockAlertEmail || undefined
        }
        if (input.stockAlertThreshold !== undefined) {
          updated.stockAlertThreshold = input.stockAlertThreshold
          ctx.redbird.stockAlertConfig.threshold = input.stockAlertThreshold
        }
        if (input.licenseKey !== undefined) {
          updated.licenseKey = input.licenseKey
          await ctx.redbird.reloadLicense(input.licenseKey)
        }
        writeFileSync(metaPath, JSON.stringify(updated, null, 2))

        // Keep storeName + primaryColor in sync inside installed email plugin configs
        const storeNameChanged = input.storeName !== undefined
        const primaryColorChanged = input.branding?.primaryColor !== undefined
        if (storeNameChanged || primaryColorChanged) {
          const EMAIL_PLUGIN_NAMES = new Set([
            '@redbird/plugin-email-resend',
            '@redbird/plugin-email-smtp',
            '@redbird/plugin-email-local',
          ])
          const installed = (updated.installedPlugins ?? []) as Array<{
            name: string
            config: Record<string, unknown>
          }>
          let dirty = false
          for (const entry of installed) {
            if (!EMAIL_PLUGIN_NAMES.has(entry.name)) continue
            if (storeNameChanged) {
              entry.config.storeName = input.storeName
              dirty = true
            }
            if (primaryColorChanged) {
              entry.config.primaryColor = (
                updated.branding as Record<string, unknown>
              )?.primaryColor
              dirty = true
            }
          }
          if (dirty) writeFileSync(metaPath, JSON.stringify(updated, null, 2))
        }

        return { ok: true }
      }),
  }),

  // ---- Stats ----
  stats: router({
    overview: adminProcedure.query(async ({ ctx }) => {
      const [allOrders, products] = await Promise.all([
        ctx.redbird.orders.list({ limit: 10000 }),
        ctx.redbird.catalog.listProducts({ limit: 10000 }),
      ])

      const customerRows = await ctx.redbird.db.query.customers.findMany({
        columns: { id: true },
      })

      const pending = allOrders.filter((o) => o.status === 'pending').length
      const paid = allOrders.filter((o) => o.status === 'paid').length
      const fulfilled = allOrders.filter((o) => o.status === 'fulfilled').length
      const cancelled = allOrders.filter((o) => o.status === 'cancelled').length
      const refunded = allOrders.filter((o) => o.status === 'refunded').length

      const totalRevenue = allOrders
        .filter((o) => o.status !== 'cancelled' && o.status !== 'refunded')
        .reduce((sum, o) => sum + o.totalAmount, 0)

      const recentOrders = [...allOrders]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)

      // Revenue by day for last 30 days
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const revenueByDay: Record<string, number> = {}
      for (let d = 0; d < 30; d++) {
        const day = new Date(thirtyDaysAgo.getTime() + d * 24 * 60 * 60 * 1000)
        const key = day.toISOString().slice(0, 10)
        revenueByDay[key] = 0
      }
      for (const o of allOrders) {
        if (o.status === 'cancelled' || o.status === 'refunded') continue
        const key = o.createdAt.toISOString().slice(0, 10)
        if (key in revenueByDay) revenueByDay[key] = (revenueByDay[key] ?? 0) + o.totalAmount
      }
      const revenueChart = Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount }))

      // Low-stock variants (at or below the configured alert threshold)
      const threshold = ctx.redbird.stockAlertConfig.threshold ?? 5
      const lowStock = products
        .flatMap((p) =>
          p.variants
            .filter((v) => (v.stockLevel?.available ?? 0) <= threshold)
            .map((v) => ({
              productId: p.id,
              productName: p.name,
              sku: v.sku,
              available: v.stockLevel?.available ?? 0,
            })),
        )
        .sort((a, b) => a.available - b.available)
        .slice(0, 8)

      return {
        ordersByStatus: { pending, paid, fulfilled, cancelled, refunded },
        totalOrders: allOrders.length,
        totalRevenue,
        productCount: products.length,
        customerCount: customerRows.length,
        recentOrders,
        revenueChart,
        lowStock,
        lowStockTotal: products.reduce(
          (n, p) =>
            n + p.variants.filter((v) => (v.stockLevel?.available ?? 0) <= threshold).length,
          0,
        ),
      }
    }),
  }),

  // ---- Orders ----
  orders: router({
    list: staffProcedure
      .input(
        z
          .object({
            status: z.enum(['pending', 'paid', 'fulfilled', 'cancelled', 'refunded']).optional(),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(100).default(20),
            offset: z.number().int().min(0).default(0),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const { limit = 20, offset = 0, status, search } = input ?? {}
        const q = search?.trim()
        if (q) {
          // Search by customer email or exact order number.
          if (q.includes('@')) return ctx.redbird.orders.listByEmail(q, { limit })
          const byNumber = await ctx.redbird.orders.getByNumber(q)
          return byNumber ? [byNumber] : []
        }
        return ctx.redbird.db.query.orders.findMany({
          where: status ? (orders, { eq }) => eq(orders.status, status) : undefined,
          orderBy: (orders) => [desc(orders.createdAt)],
          limit,
          offset,
        })
      }),

    count: staffProcedure
      .input(
        z
          .object({
            status: z.enum(['pending', 'paid', 'fulfilled', 'cancelled', 'refunded']).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => ctx.redbird.orders.count({ status: input?.status })),

    byId: staffProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const order = await ctx.redbird.orders.get(input.id)
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
        return order
      }),

    markPaid: warehouseProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.orders.markPaid(input.id)),

    markFulfilled: warehouseProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.orders.markFulfilled(input.id)),

    cancel: warehouseProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const order = await ctx.redbird.orders.cancel(input.id)
        await writeAudit(ctx, 'order.cancel', 'order', input.id)
        return order
      }),

    refund: warehouseProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const order = await ctx.redbird.orders.refund(input.id)
        await writeAudit(ctx, 'order.refund', 'order', input.id, { amount: order.totalAmount })
        return order
      }),

    refundPartial: warehouseProcedure
      .input(z.object({ id: z.string().uuid(), amount: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const order = await ctx.redbird.orders.refundPartial(input.id, input.amount)
        await writeAudit(ctx, 'order.refund_partial', 'order', input.id, { amount: input.amount })
        return order
      }),

    setTracking: warehouseProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          trackingNumber: z.string().min(1),
          trackingUrl: z.string().url().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.orders.setTracking(input.id, input.trackingNumber, input.trackingUrl),
      ),
  }),

  // ---- Catalog ----
  catalog: router({
    list: adminProcedure
      .input(
        z
          .object({
            status: z.enum(['draft', 'active', 'archived']).optional(),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(100).default(20),
            offset: z.number().int().min(0).default(0),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const { limit = 20, offset = 0, status, search } = input ?? {}
        if (search?.trim()) {
          return ctx.redbird.catalog.search(search.trim(), { limit, status })
        }
        return ctx.redbird.catalog.listProducts({ limit, offset, status })
      }),

    count: adminProcedure
      .input(z.object({ status: z.enum(['draft', 'active', 'archived']).optional() }).optional())
      .query(async ({ ctx, input }) =>
        ctx.redbird.catalog.countProducts({ status: input?.status }),
      ),

    byId: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => ctx.redbird.catalog.getProductById(input.id)),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          status: z.enum(['draft', 'active', 'archived']).default('draft'),
          taxRateBp: z.number().int().min(0).nullable().optional(),
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
        return ctx.redbird.catalog.createProduct(
          {
            ...productInput,
            description: productInput.description ?? null,
            taxRateBp: productInput.taxRateBp ?? null,
          },
          [{ ...variant, inventoryQuantity: 0, attributes: {} }],
        )
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          status: z.enum(['draft', 'active', 'archived']).optional(),
          brandId: z.string().uuid().nullable().optional(),
          isVirtual: z.boolean().optional(),
          metaTitle: z.string().nullable().optional(),
          metaDescription: z.string().nullable().optional(),
          taxRateBp: z.number().int().min(0).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.catalog.updateProduct>[1] = {}
        if (input.name !== undefined) patch.name = input.name
        if (input.slug !== undefined) patch.slug = input.slug
        if (input.description !== undefined) patch.description = input.description
        if (input.status !== undefined) patch.status = input.status
        if (input.brandId !== undefined) patch.brandId = input.brandId
        if (input.isVirtual !== undefined) patch.isVirtual = input.isVirtual
        if (input.metaTitle !== undefined) patch.metaTitle = input.metaTitle
        if (input.metaDescription !== undefined) patch.metaDescription = input.metaDescription
        if (input.taxRateBp !== undefined) patch.taxRateBp = input.taxRateBp
        return ctx.redbird.catalog.updateProduct(input.id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.catalog.deleteProduct(input.id)),

    addVariant: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          sku: z.string().min(1),
          name: z.string().min(1),
          priceAmount: z.number().int().min(0),
          priceCurrency: z.string().length(3),
          inventoryQuantity: z.number().int().min(0).default(0),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.catalog.addVariant({ ...input, attributes: {} }),
      ),

    updateVariant: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          sku: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
          priceAmount: z.number().int().min(0).optional(),
          priceCurrency: z.string().length(3).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.catalog.updateVariant>[1] = {}
        if (input.sku !== undefined) patch.sku = input.sku
        if (input.name !== undefined) patch.name = input.name
        if (input.priceAmount !== undefined) patch.priceAmount = input.priceAmount
        if (input.priceCurrency !== undefined) patch.priceCurrency = input.priceCurrency
        return ctx.redbird.catalog.updateVariant(input.id, patch)
      }),

    deleteVariant: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.catalog.deleteVariant(input.id)),

    listRelations: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(async ({ ctx, input }) => ctx.redbird.catalog.listRelations(input.productId)),

    addRelation: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          relatedProductId: z.string().uuid(),
          type: z.enum(['related', 'upsell', 'cross_sell']).default('related'),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.catalog.addRelation(input.productId, input.relatedProductId, input.type),
      ),

    removeRelation: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.catalog.removeRelation(input.id)),

    listFeatures: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(async ({ ctx, input }) => ctx.redbird.productFeatures.list(input.productId)),

    addFeature: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          name: z.string().min(1),
          value: z.string().min(1),
          position: z.number().int().min(0).default(0),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.productFeatures.add(input.productId, {
          name: input.name,
          value: input.value,
          position: input.position,
        }),
      ),

    updateFeature: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          value: z.string().min(1).optional(),
          position: z.number().int().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.productFeatures.update>[1] = {}
        if (input.name !== undefined) patch.name = input.name
        if (input.value !== undefined) patch.value = input.value
        if (input.position !== undefined) patch.position = input.position
        return ctx.redbird.productFeatures.update(input.id, patch)
      }),

    removeFeature: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.productFeatures.remove(input.id)),

    exportCsv: adminProcedure.query(async ({ ctx }) => {
      const products = await ctx.redbird.catalog.listProducts({ limit: 10000 })
      const rows: string[] = [
        [
          'id',
          'slug',
          'name',
          'description',
          'status',
          'sku',
          'variant_name',
          'price',
          'currency',
          'stock',
        ].join(','),
      ]
      for (const p of products) {
        if (p.variants.length === 0) {
          rows.push(
            [
              p.id,
              p.slug,
              `"${p.name.replace(/"/g, '""')}"`,
              `"${(p.description ?? '').replace(/"/g, '""')}"`,
              p.status,
              '',
              '',
              '',
              '',
              '',
            ].join(','),
          )
        }
        for (const v of p.variants) {
          rows.push(
            [
              p.id,
              p.slug,
              `"${p.name.replace(/"/g, '""')}"`,
              `"${(p.description ?? '').replace(/"/g, '""')}"`,
              p.status,
              v.sku,
              `"${v.name.replace(/"/g, '""')}"`,
              (v.priceAmount / 100).toFixed(2),
              v.priceCurrency,
              v.stockLevel?.available ?? 0,
            ].join(','),
          )
        }
      }
      return rows.join('\n')
    }),

    /**
     * Bulk import products+variants from a CSV matching exportCsv's own
     * format (id, slug, name, description, status, sku, variant_name,
     * price, currency, stock) — round-trips with export, and `id` is
     * accepted but ignored: rows are matched by slug (product) and sku
     * (variant), so a plain hand-written CSV works too. Rows sharing a
     * slug become one product with multiple variants. Never throws on a
     * per-row problem — collects it into `errors` and keeps going, since a
     * typo in row 40 of a 500-row import shouldn't abort the other 499.
     */
    importCsv: adminProcedure
      .input(z.object({ csv: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { csvToRecords } = await import('../csv.js')
        const records = csvToRecords(input.csv)

        const groups: Array<{ slug: string; rows: Record<string, string>[] }> = []
        for (const rec of records) {
          const slug = rec.slug?.trim()
          if (!slug) continue
          const group = groups.find((g) => g.slug === slug)
          if (group) group.rows.push(rec)
          else groups.push({ slug, rows: [rec] })
        }

        const results: Array<{
          slug: string
          status: 'created' | 'updated' | 'error'
          variantCount: number
          message?: string
        }> = []

        for (const { slug, rows } of groups) {
          const first = rows[0]
          if (!first) continue
          try {
            const status = ['draft', 'active', 'archived'].includes(first.status ?? '')
              ? (first.status as 'draft' | 'active' | 'archived')
              : 'draft'
            const productPatch = {
              slug,
              name: first.name?.trim() || slug,
              description: first.description?.trim() || null,
              status,
            }

            const existing = await ctx.redbird.catalog.getProductBySlug(slug)
            const product = existing
              ? await ctx.redbird.catalog.updateProduct(existing.id, productPatch)
              : await ctx.redbird.catalog.createProduct(productPatch)

            try {
              let variantCount = 0
              for (const row of rows) {
                const sku = row.sku?.trim()
                if (!sku) continue
                const priceAmount = Math.round(Number.parseFloat(row.price || '0') * 100)
                if (!Number.isFinite(priceAmount)) {
                  throw new Error(`Row for SKU "${sku}" has an invalid price: "${row.price}"`)
                }
                const currency = (
                  row.currency?.trim() || ctx.redbird.config.defaultCurrency
                ).toUpperCase()
                const variantName = row.variant_name?.trim() || 'Default'

                const existingVariant = existing?.variants.find((v) => v.sku === sku)
                const variant = existingVariant
                  ? await ctx.redbird.catalog.updateVariant(existingVariant.id, {
                      name: variantName,
                      priceAmount,
                      priceCurrency: currency,
                    })
                  : await ctx.redbird.catalog.addVariant({
                      productId: product.id,
                      sku,
                      name: variantName,
                      priceAmount,
                      priceCurrency: currency,
                    })
                variantCount++

                if (row.stock?.trim()) {
                  const qty = Number.parseInt(row.stock, 10)
                  if (Number.isFinite(qty) && qty >= 0) {
                    await ctx.redbird.stock.set(variant.id, qty)
                  }
                }
              }

              results.push({ slug, status: existing ? 'updated' : 'created', variantCount })
            } catch (err) {
              // A newly-created product with a failed variant row would otherwise be
              // left behind as an empty, invisible-in-the-error orphan — clean it up
              // so "error" in the results actually means nothing was persisted.
              if (!existing) await ctx.redbird.catalog.deleteProduct(product.id)
              throw err
            }
          } catch (err) {
            results.push({
              slug,
              status: 'error',
              variantCount: 0,
              message: err instanceof Error ? err.message : 'Import failed',
            })
          }
        }

        return { results }
      }),
  }),

  // ---- Customers ----
  customers: router({
    get: staffProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const customer = await ctx.redbird.db.query.customers.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        columns: { passwordHash: false },
      })
      if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      const customerOrders = await ctx.redbird.orders.list({ customerId: input.id, limit: 50 })
      return { ...customer, orders: customerOrders }
    }),

    list: staffProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).default(20),
            offset: z.number().int().min(0).default(0),
            search: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.customers.list>[0] = {
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
        }
        if (input?.search !== undefined) opts.search = input.search
        return ctx.redbird.customers.list(opts)
      }),
  }),

  // ---- Promos ----
  promos: router({
    list: adminProcedure.query(async ({ ctx }) => ctx.redbird.promos.list()),

    get: adminProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const promo = await ctx.redbird.promos.get(input.code)
        if (!promo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Promo code not found' })
        return promo
      }),

    create: adminProcedure
      .input(
        z.object({
          code: z.string().min(1),
          type: z.enum(['percentage', 'fixed', 'bogo', 'tiered']),
          // Ignored for bogo/tiered — the DB column is NOT NULL so the client
          // sends a filler value (0) for those types.
          value: z.number().int().min(0),
          currency: z.string().length(3).optional(),
          minimumAmount: z.number().int().min(0).optional(),
          maxUses: z.number().int().min(1).optional(),
          expiresAt: z.string().datetime().optional(),
          bogoConfig: z
            .object({
              buyQuantity: z.number().int().min(1),
              getQuantity: z.number().int().min(1),
              getDiscountPercent: z.number().int().min(1).max(100),
            })
            .optional(),
          tiers: z
            .array(
              z.object({
                minQuantity: z.number().int().min(1),
                discountPercent: z.number().int().min(1).max(100),
              }),
            )
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.redbird.promos.create({
          code: input.code,
          type: input.type,
          value: input.value,
          currency: input.currency,
          minimumAmount: input.minimumAmount,
          maxUses: input.maxUses,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          bogoConfig: input.bogoConfig,
          tiers: input.tiers,
        })
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          type: z.enum(['percentage', 'fixed', 'bogo', 'tiered']).optional(),
          value: z.number().int().min(0).optional(),
          currency: z.string().length(3).optional(),
          minimumAmount: z.number().int().min(0).nullable().optional(),
          maxUses: z.number().int().min(1).nullable().optional(),
          expiresAt: z.string().datetime().nullable().optional(),
          active: z.boolean().optional(),
          bogoConfig: z
            .object({
              buyQuantity: z.number().int().min(1),
              getQuantity: z.number().int().min(1),
              getDiscountPercent: z.number().int().min(1).max(100),
            })
            .nullable()
            .optional(),
          tiers: z
            .array(
              z.object({
                minQuantity: z.number().int().min(1),
                discountPercent: z.number().int().min(1).max(100),
              }),
            )
            .nullable()
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const {
          id,
          type,
          value,
          currency,
          active,
          minimumAmount,
          maxUses,
          expiresAt,
          bogoConfig,
          tiers,
        } = input
        const patch: Parameters<typeof ctx.redbird.promos.update>[1] = {}
        if (type !== undefined) patch.type = type
        if (value !== undefined) patch.value = value
        if (currency !== undefined) patch.currency = currency
        if (active !== undefined) patch.active = active
        if (minimumAmount !== undefined) patch.minimumAmount = minimumAmount
        if (maxUses !== undefined) patch.maxUses = maxUses
        if (expiresAt !== undefined) patch.expiresAt = expiresAt ? new Date(expiresAt) : null
        if (bogoConfig !== undefined) patch.bogoConfig = bogoConfig
        if (tiers !== undefined) patch.tiers = tiers
        return ctx.redbird.promos.update(id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.promos.delete(input.id)),

    deactivate: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.promos.update(input.id, { active: false })),
  }),

  // ---- Reviews moderation (data layer owned by the reviews module) ----
  reviews: router({
    list: adminProcedure
      .input(
        z
          .object({ productId: z.string().uuid().optional(), approvedOnly: z.boolean().optional() })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const { listReviews, listAllReviews } = await reviewsPlugin()
        if (input?.productId) {
          return listReviews(ctx.redbird.db, input.productId, {
            approvedOnly: input?.approvedOnly ?? false,
          })
        }
        return listAllReviews(ctx.redbird.db)
      }),

    get: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const review = await (await reviewsPlugin()).getReview(ctx.redbird.db, input.id)
      if (!review) throw new TRPCError({ code: 'NOT_FOUND', message: 'Review not found' })
      return review
    }),

    approve: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) =>
        (await reviewsPlugin()).approveReview(ctx.redbird.db, input.id),
      ),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) =>
        (await reviewsPlugin()).deleteReview(ctx.redbird.db, input.id),
      ),
  }),

  // ---- Return requests ----
  returns: router({
    list: warehouseProcedure
      .input(
        z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).optional(),
      )
      .query(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.returns.list>[0] = {}
        if (input?.status !== undefined) opts.status = input.status
        return ctx.redbird.returns.list(opts)
      }),

    approve: warehouseProcedure
      .input(z.object({ id: z.string().uuid(), adminNote: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const req = await ctx.redbird.returns.approve(input.id, input.adminNote)
        try {
          await ctx.redbird.orders.refund(req.orderId)
        } catch {}
        await writeAudit(ctx, 'return.approve', 'return_request', input.id, {
          orderId: req.orderId,
        })
        return req
      }),

    reject: warehouseProcedure
      .input(z.object({ id: z.string().uuid(), adminNote: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const req = await ctx.redbird.returns.reject(input.id, input.adminNote)
        await writeAudit(ctx, 'return.reject', 'return_request', input.id)
        return req
      }),
  }),

  // ---- Stock management ----
  stock: router({
    get: warehouseProcedure
      .input(z.object({ variantId: z.string().uuid() }))
      .query(async ({ ctx, input }) => ctx.redbird.stock.get(input.variantId)),

    set: warehouseProcedure
      .input(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(0) }))
      .mutation(async ({ ctx, input }) => ctx.redbird.stock.set(input.variantId, input.quantity)),

    adjust: warehouseProcedure
      .input(z.object({ variantId: z.string().uuid(), delta: z.number().int() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.stock.adjust(input.variantId, input.delta)),
  }),

  // ---- Order notes ----
  orderNotes: router({
    add: staffProcedure
      .input(z.object({ orderId: z.string().uuid(), note: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => ctx.redbird.orders.addNote(input.orderId, input.note)),
  }),

  // ---- Categories ----
  categories: router({
    list: adminProcedure
      .input(z.object({ parentId: z.string().uuid().nullable().optional() }).optional())
      .query(async ({ ctx, input }) => ctx.redbird.categories.list(input ?? {})),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z.string().min(1),
          description: z.string().optional(),
          imageUrl: z.string().url().optional(),
          parentId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const data: Parameters<typeof ctx.redbird.categories.create>[0] = {
          name: input.name,
          slug: input.slug,
        }
        if (input.description) data.description = input.description
        if (input.imageUrl) data.imageUrl = input.imageUrl
        if (input.parentId) data.parentId = input.parentId
        return ctx.redbird.categories.create(data)
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          imageUrl: z.string().url().nullable().optional(),
          parentId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.categories.update>[1] = {}
        if (input.name !== undefined) patch.name = input.name
        if (input.slug !== undefined) patch.slug = input.slug
        if (input.description !== undefined) patch.description = input.description
        if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl
        if (input.parentId !== undefined) patch.parentId = input.parentId
        return ctx.redbird.categories.update(input.id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.categories.delete(input.id)),

    assignProduct: adminProcedure
      .input(z.object({ productId: z.string().uuid(), categoryId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.categories.assignProduct(input.productId, input.categoryId),
      ),

    unassignProduct: adminProcedure
      .input(z.object({ productId: z.string().uuid(), categoryId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.categories.unassignProduct(input.productId, input.categoryId),
      ),

    listProducts: adminProcedure
      .input(
        z.object({
          categoryId: z.string().uuid(),
          limit: z.number().int().default(100),
          offset: z.number().int().default(0),
        }),
      )
      .query(async ({ ctx, input }) =>
        ctx.redbird.categories.listProducts(input.categoryId, {
          limit: input.limit,
          offset: input.offset,
        }),
      ),

    forProduct: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const rows = await ctx.redbird.db.query.productCategories.findMany({
          where: (pc, { eq }) => eq(pc.productId, input.productId),
          with: { category: true },
        })
        return rows.map((r) => r.category)
      }),
  }),

  // ---- Product images ----
  images: router({
    list: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(async ({ ctx, input }) => ctx.redbird.images.list(input.productId)),

    add: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          url: z.string().url(),
          alt: z.string().optional(),
          variantId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const data: Parameters<typeof ctx.redbird.images.add>[1] = { url: input.url }
        if (input.alt) data.alt = input.alt
        if (input.variantId) data.variantId = input.variantId
        return ctx.redbird.images.add(input.productId, data)
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          alt: z.string().optional(),
          position: z.number().int().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.images.update>[1] = {}
        if (input.alt !== undefined) patch.alt = input.alt
        if (input.position !== undefined) patch.position = input.position
        return ctx.redbird.images.update(input.id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.images.delete(input.id)),

    reorder: adminProcedure
      .input(z.object({ productId: z.string().uuid(), imageIds: z.array(z.string().uuid()) }))
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.images.reorder(input.productId, input.imageIds),
      ),
  }),

  // ---- CMS pages ----
  cms: router({
    list: adminProcedure.query(async ({ ctx }) => ctx.redbird.cms.list()),

    create: adminProcedure
      .input(
        z.object({
          slug: z.string().min(1),
          title: z.string().min(1),
          content: z.string().default(''),
          excerpt: z.string().optional(),
          published: z.boolean().default(false),
          position: z.number().int().default(0),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const data: Parameters<typeof ctx.redbird.cms.create>[0] = {
          slug: input.slug,
          title: input.title,
          content: input.content,
          published: input.published,
          position: input.position,
        }
        if (input.excerpt) data.excerpt = input.excerpt
        return ctx.redbird.cms.create(data)
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          slug: z.string().min(1).optional(),
          title: z.string().min(1).optional(),
          content: z.string().optional(),
          excerpt: z.string().nullable().optional(),
          published: z.boolean().optional(),
          position: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.cms.update>[1] = {}
        if (input.slug !== undefined) patch.slug = input.slug
        if (input.title !== undefined) patch.title = input.title
        if (input.content !== undefined) patch.content = input.content
        if (input.published !== undefined) patch.published = input.published
        if (input.position !== undefined) patch.position = input.position
        if (input.excerpt !== undefined && input.excerpt !== null) patch.excerpt = input.excerpt
        return ctx.redbird.cms.update(input.id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.cms.delete(input.id)),
  }),

  // ---- Abandoned cart recovery ----
  abandonedCart: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const rows = await ctx.redbird.db.query.carts.findMany({
        where: eq(carts.status, 'abandoned'),
        with: { lineItems: true },
        orderBy: (c, { desc: d }) => [d(c.updatedAt)],
        limit: 200,
      })
      return rows
    }),

    runRecovery: adminProcedure
      .input(
        z
          .object({
            idleMinutes: z.number().int().min(5).max(10080).default(60),
            storeUrl: z.string().url().optional(),
          })
          .optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.abandonedCart.runRecovery>[0] = {}
        opts.idleMinutes = input?.idleMinutes ?? 60
        const storeName = ctx.redbird.config.storeName
        if (storeName) opts.storeName = storeName
        if (input?.storeUrl) opts.storeUrl = input.storeUrl
        return ctx.redbird.abandonedCart.runRecovery(opts)
      }),
  }),

  // ---- Product translations (i18n) ----
  translations: router({
    list: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(({ ctx, input }) => ctx.redbird.i18n.list(input.productId)),

    upsert: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          locale: z.string().min(2).max(10),
          name: z.string().min(1),
          description: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.i18n.upsert>[2] = { name: input.name }
        if (input.description !== undefined) opts.description = input.description
        return ctx.redbird.i18n.upsert(input.productId, input.locale, opts)
      }),

    delete: adminProcedure
      .input(z.object({ productId: z.string().uuid(), locale: z.string().min(2) }))
      .mutation(({ ctx, input }) => ctx.redbird.i18n.delete(input.productId, input.locale)),
  }),

  // ---- Brands ----
  brands: router({
    list: adminProcedure.query(({ ctx }) => ctx.redbird.brands.list()),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          slug: z
            .string()
            .min(1)
            .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
          description: z.string().optional(),
          logoUrl: z.string().url().optional(),
          websiteUrl: z.string().url().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await ctx.redbird.brands.create(input)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to create brand'
          throw new TRPCError({ code: 'CONFLICT', message: msg })
        }
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          description: z.string().optional(),
          logoUrl: z.string().url().optional(),
          websiteUrl: z.string().url().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...patch } = input
        const p: Parameters<typeof ctx.redbird.brands.update>[1] = {}
        if (patch.name !== undefined) p.name = patch.name
        if (patch.slug !== undefined) p.slug = patch.slug
        if (patch.description !== undefined) p.description = patch.description
        if (patch.logoUrl !== undefined) p.logoUrl = patch.logoUrl
        if (patch.websiteUrl !== undefined) p.websiteUrl = patch.websiteUrl
        return ctx.redbird.brands.update(id, p)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.brands.delete(input.id)),
  }),

  // ---- Suppliers ----
  suppliers: router({
    list: adminProcedure.query(({ ctx }) => ctx.redbird.suppliers.list()),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.suppliers.create>[0] = { name: input.name }
        if (input.contactEmail !== undefined) opts.contactEmail = input.contactEmail
        if (input.contactPhone !== undefined) opts.contactPhone = input.contactPhone
        if (input.address !== undefined) opts.address = input.address
        if (input.notes !== undefined) opts.notes = input.notes
        return ctx.redbird.suppliers.create(opts)
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...patch } = input
        const p: Parameters<typeof ctx.redbird.suppliers.update>[1] = {}
        if (patch.name !== undefined) p.name = patch.name
        if (patch.contactEmail !== undefined) p.contactEmail = patch.contactEmail
        if (patch.contactPhone !== undefined) p.contactPhone = patch.contactPhone
        if (patch.address !== undefined) p.address = patch.address
        if (patch.notes !== undefined) p.notes = patch.notes
        return ctx.redbird.suppliers.update(id, p)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.suppliers.delete(input.id)),

    linkProduct: adminProcedure
      .input(
        z.object({
          supplierId: z.string().uuid(),
          productId: z.string().uuid(),
          supplierSku: z.string().optional(),
          costPrice: z.number().int().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.suppliers.linkProduct>[2] = {}
        if (input.supplierSku !== undefined) opts.supplierSku = input.supplierSku
        if (input.costPrice !== undefined) opts.costPrice = input.costPrice
        return ctx.redbird.suppliers.linkProduct(input.supplierId, input.productId, opts)
      }),

    unlinkProduct: adminProcedure
      .input(z.object({ supplierId: z.string().uuid(), productId: z.string().uuid() }))
      .mutation(({ ctx, input }) =>
        ctx.redbird.suppliers.unlinkProduct(input.supplierId, input.productId),
      ),

    getProductSuppliers: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(({ ctx, input }) => ctx.redbird.suppliers.getProductSuppliers(input.productId)),
  }),

  // ---- Loyalty ----
  loyalty: adminLoyaltyRouter,

  // ---- Gift Cards ----
  giftCards: router({
    list: adminProcedure.query(({ ctx }) => ctx.redbird.giftCards.list()),

    create: adminProcedure
      .input(
        z.object({
          balance: z.number().int().min(1),
          currency: z.string().length(3),
          code: z.string().optional(),
          issuedToEmail: z.string().email().optional(),
          expiresAt: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.giftCards.create({
          balance: input.balance,
          currency: input.currency,
          ...(input.code ? { code: input.code } : {}),
          ...(input.issuedToEmail ? { issuedToEmail: input.issuedToEmail } : {}),
          ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
        }),
      ),

    getByCode: adminProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const card = await ctx.redbird.giftCards.get(input.code)
        if (!card) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift card not found' })
        return card
      }),

    getById: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const card = await ctx.redbird.giftCards.getById(input.id)
        if (!card) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift card not found' })
        return card
      }),

    void: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.giftCards.void(input.id)),
  }),

  // ---- Downloads ----
  downloads: router({
    list: adminProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .query(({ ctx, input }) => ctx.redbird.downloads.getForProduct(input.productId)),

    add: adminProcedure
      .input(
        z.object({
          productId: z.string().uuid(),
          filename: z.string().min(1),
          url: z.string().min(1),
          fileSize: z.number().int().positive().optional(),
          mimeType: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.downloads.addFile>[1] = {
          filename: input.filename,
          url: input.url,
        }
        if (input.fileSize !== undefined) opts.fileSize = input.fileSize
        if (input.mimeType !== undefined) opts.mimeType = input.mimeType
        return ctx.redbird.downloads.addFile(input.productId, opts)
      }),

    remove: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.downloads.removeFile(input.id)),
  }),

  // ---- Webhooks ----
  webhooks: router({
    list: adminProcedure.query(({ ctx }) => ctx.redbird.webhooks.list()),

    create: adminProcedure
      .input(
        z.object({
          url: z.string().url(),
          events: z.array(z.string().min(1)).min(1),
          secret: z.string().min(1).optional(),
          description: z.string().optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(({ ctx, input }) => ctx.redbird.webhooks.create(input)),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          url: z.string().url().optional(),
          events: z.array(z.string().min(1)).min(1).optional(),
          active: z.boolean().optional(),
          description: z.string().nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const { id, ...patch } = input
        return ctx.redbird.webhooks.update(id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.webhooks.delete(input.id)),

    deliveries: adminProcedure
      .input(
        z.object({
          webhookId: z.string().uuid(),
          limit: z.number().int().min(1).max(100).default(20),
          status: z.enum(['pending', 'success', 'failed']).optional(),
        }),
      )
      .query(({ ctx, input }) =>
        ctx.redbird.webhooks.listDeliveries(input.webhookId, {
          limit: input.limit,
          ...(input.status ? { status: input.status } : {}),
        }),
      ),

    redeliver: adminProcedure
      .input(z.object({ deliveryId: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.webhooks.redeliver(input.deliveryId)),
  }),

  // ---- Customer Groups ----
  customerGroups: router({
    list: adminProcedure.query(({ ctx }) => ctx.redbird.customerGroupsSvc.list()),

    get: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const g = await ctx.redbird.customerGroupsSvc.get(input.id)
      if (!g) throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' })
      return g
    }),

    create: adminProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const data: Parameters<typeof ctx.redbird.customerGroupsSvc.create>[0] = {
          name: input.name,
        }
        if (input.description !== undefined) data.description = input.description
        return ctx.redbird.customerGroupsSvc.create(data)
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const patch: Parameters<typeof ctx.redbird.customerGroupsSvc.update>[1] = {}
        if (input.name !== undefined) patch.name = input.name
        if (input.description !== undefined) patch.description = input.description
        return ctx.redbird.customerGroupsSvc.update(input.id, patch)
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.customerGroupsSvc.delete(input.id)),

    addMember: adminProcedure
      .input(z.object({ groupId: z.string().uuid(), customerId: z.string().uuid() }))
      .mutation(({ ctx, input }) =>
        ctx.redbird.customerGroupsSvc.addMember(input.groupId, input.customerId),
      ),

    removeMember: adminProcedure
      .input(z.object({ groupId: z.string().uuid(), customerId: z.string().uuid() }))
      .mutation(({ ctx, input }) =>
        ctx.redbird.customerGroupsSvc.removeMember(input.groupId, input.customerId),
      ),

    listMembers: adminProcedure
      .input(z.object({ groupId: z.string().uuid() }))
      .query(({ ctx, input }) => ctx.redbird.customerGroupsSvc.listMembers(input.groupId)),

    setPriceRule: adminProcedure
      .input(
        z.object({
          groupId: z.string().uuid(),
          variantId: z.string().uuid(),
          priceAmount: z.number().int().min(0),
          priceCurrency: z.string().length(3),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.redbird.customerGroupsSvc.setPriceRule(
          input.groupId,
          input.variantId,
          input.priceAmount,
          input.priceCurrency,
        ),
      ),

    removePriceRule: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => ctx.redbird.customerGroupsSvc.removePriceRule(input.id)),

    listPriceRules: adminProcedure
      .input(z.object({ groupId: z.string().uuid() }))
      .query(({ ctx, input }) => ctx.redbird.customerGroupsSvc.listPriceRules(input.groupId)),
  }),

  // ---- Plugins ----
  plugins: router({
    list: adminProcedure.query(({ ctx }) => {
      return ctx.redbird.plugins.list().map((p) => ({
        name: p.name,
        version: p.version ?? null,
      }))
    }),

    listInstalled: adminProcedure.query(() => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      return (meta.installedPlugins ?? []) as Array<{
        name: string
        config: Record<string, unknown>
      }>
    }),

    install: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          config: z.record(z.unknown()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Skip if already active in this session
        if (ctx.redbird.plugins.list().some((p) => p.name === input.name)) {
          return { ok: true }
        }

        // Map package name → named export of the factory function
        const FACTORY_MAP: Record<string, string> = {
          '@redbird/plugin-email-local': 'local',
          '@redbird/plugin-stripe': 'stripe',
          '@redbird/plugin-paypal': 'paypal',
          '@redbird/plugin-email-resend': 'resend',
          '@redbird/plugin-email-smtp': 'smtp',
          '@redbird/plugin-shipping-flat': 'shippingFlat',
          '@redbird/plugin-shipping-zones': 'shippingZones',
          '@redbird/plugin-shipping-mondial-relay': 'shippingMondialRelay',
          '@redbird/plugin-tax-rules': 'taxRules',
          '@redbird/plugin-vat-eu': 'vatEu',
          '@redbird/plugin-reviews': 'reviews',
          '@redbird/plugin-analytics': 'analytics',
        }
        const factoryName = FACTORY_MAP[input.name]
        if (!factoryName)
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown plugin: ${input.name}` })

        let mod: Record<string, unknown>
        try {
          mod = (await import(input.name)) as Record<string, unknown>
        } catch {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Package ${input.name} is not installed. Run: pnpm add ${input.name}`,
          })
        }

        const factory = mod[factoryName]
        if (typeof factory !== 'function') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `${input.name} has no export "${factoryName}"`,
          })
        }

        // Type-coerce port for smtp
        let cfg = (input.config ?? {}) as Record<string, unknown>
        if (input.name === '@redbird/plugin-email-smtp' && typeof cfg.port === 'string') {
          cfg = { ...cfg, port: Number(cfg.port) }
        }

        // Inject store branding into email plugins (storeName, primaryColor)
        const EMAIL_PLUGINS = new Set([
          '@redbird/plugin-email-resend',
          '@redbird/plugin-email-smtp',
          '@redbird/plugin-email-local',
        ])
        if (EMAIL_PLUGINS.has(input.name)) {
          const metaForBranding = resolve(process.cwd(), 'redbird.meta.json')
          let brandingMeta: Record<string, unknown> = {}
          try {
            brandingMeta = JSON.parse(readFileSync(metaForBranding, 'utf8'))
          } catch {}
          const storeName =
            (brandingMeta.storeName as string | undefined) ?? ctx.redbird.config.storeName
          const primaryColor = (brandingMeta.branding as Record<string, unknown> | undefined)
            ?.primaryColor as string | undefined
          if (storeName && !cfg.storeName) cfg = { ...cfg, storeName }
          if (primaryColor && !cfg.primaryColor) cfg = { ...cfg, primaryColor }
        }

        const plugin = (factory as (c: unknown) => unknown)(cfg)
        ctx.redbird.installPlugin(plugin)

        // Persist to meta.json
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const installed = (meta.installedPlugins ?? []) as Array<{
          name: string
          config: Record<string, unknown>
        }>
        const idx = installed.findIndex((p) => p.name === input.name)
        const entry = { name: input.name, config: cfg }
        if (idx >= 0) installed[idx] = entry
        else installed.push(entry)
        meta.installedPlugins = installed
        writeFileSync(metaPath, JSON.stringify(meta, null, 2))

        return { ok: true }
      }),

    uninstall: adminProcedure.input(z.object({ name: z.string().min(1) })).mutation(({ input }) => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      const installed = (meta.installedPlugins ?? []) as Array<{ name: string }>
      meta.installedPlugins = installed.filter((p) => p.name !== input.name)
      writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      return { ok: true, restartRequired: true }
    }),

    getConfig: adminProcedure.query(() => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      return (meta.pluginConfig ?? {}) as Record<string, Record<string, string>>
    }),

    saveConfig: adminProcedure
      .input(
        z.object({
          pluginName: z.string().min(1),
          config: z.record(z.string()),
        }),
      )
      .mutation(({ input }) => {
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const pluginConfig = (meta.pluginConfig ?? {}) as Record<string, Record<string, string>>
        pluginConfig[input.pluginName] = { ...pluginConfig[input.pluginName], ...input.config }
        meta.pluginConfig = pluginConfig
        writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        return { ok: true }
      }),
  }),

  // ---- Bundled backoffice modules (reviews, loyalty, gift cards…) ----
  // These ship with the build; "install/uninstall/enable/disable" just toggles
  // whether their sidebar entry & page are mounted. State lives in meta.json
  // under `moduleStates` (absent = not installed).
  modules: router({
    list: adminProcedure.query(() => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      return (meta.moduleStates ?? {}) as Record<string, 'active' | 'disabled'>
    }),

    setState: adminProcedure
      .input(z.object({ name: z.string().min(1), state: z.enum(['active', 'disabled']) }))
      .mutation(({ input }) => {
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const states = (meta.moduleStates ?? {}) as Record<string, string>
        states[input.name] = input.state
        meta.moduleStates = states
        writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        return { ok: true }
      }),

    uninstall: adminProcedure.input(z.object({ name: z.string().min(1) })).mutation(({ input }) => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      const states = (meta.moduleStates ?? {}) as Record<string, string>
      delete states[input.name]
      meta.moduleStates = states
      // Also drop any saved per-module config
      const pluginConfig = (meta.pluginConfig ?? {}) as Record<string, unknown>
      delete pluginConfig[input.name]
      meta.pluginConfig = pluginConfig
      writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      return { ok: true }
    }),
  }),

  // ---- Saved theme presets (named design-token snapshots) ----
  themes: router({
    listPresets: adminProcedure.query(() => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      return (meta.themePresets ?? {}) as Record<string, Record<string, string>>
    }),

    savePreset: adminProcedure
      .input(z.object({ name: z.string().min(1).max(60), tokens: z.record(z.string()) }))
      .mutation(({ input }) => {
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const presets = (meta.themePresets ?? {}) as Record<string, unknown>
        presets[input.name] = input.tokens
        meta.themePresets = presets
        writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        return { ok: true }
      }),

    deletePreset: adminProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(({ input }) => {
        const metaPath = resolve(process.cwd(), 'redbird.meta.json')
        let meta: Record<string, unknown> = {}
        try {
          meta = JSON.parse(readFileSync(metaPath, 'utf8'))
        } catch {}
        const presets = (meta.themePresets ?? {}) as Record<string, unknown>
        delete presets[input.name]
        meta.themePresets = presets
        writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        return { ok: true }
      }),
  }),

  // ---- Storefront themes (sellable Next.js storefront templates) ----
  // Catalog of full storefront themes you can download (deploy yourself) or set
  // as the active served storefront. Free themes are open; paid ones unlock once
  // purchased (ownership persisted in meta.json `ownedThemes`).
  storefrontThemes: router({
    list: adminProcedure.query(() => {
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      const owned = (meta.ownedThemes ?? []) as string[]
      const active = (meta.activeStorefrontTheme as string | undefined) ?? 'classic'
      return {
        active,
        themes: STOREFRONT_THEMES.map((t) => ({
          ...t,
          owned: t.plan === 'free' || owned.includes(t.id),
        })),
      }
    }),

    purchase: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ input }) => {
      const theme = STOREFRONT_THEMES.find((t) => t.id === input.id)
      if (!theme) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown theme' })
      // NOTE: payment integration is future work — this records ownership so the
      // download/activate flow can be exercised end-to-end.
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      const owned = new Set((meta.ownedThemes ?? []) as string[])
      owned.add(input.id)
      meta.ownedThemes = [...owned]
      writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      return { ok: true }
    }),

    setActive: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ input }) => {
      const theme = STOREFRONT_THEMES.find((t) => t.id === input.id)
      if (!theme) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unknown theme' })
      const metaPath = resolve(process.cwd(), 'redbird.meta.json')
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {}
      const owned = (meta.ownedThemes ?? []) as string[]
      if (theme.plan !== 'free' && !owned.includes(theme.id)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Purchase this theme first.' })
      }
      meta.activeStorefrontTheme = input.id
      writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      return { ok: true }
    }),
  }),

  // ---- Local email mailbox ----
  emails: router({
    list: adminProcedure.query(({ ctx }) => {
      if (!ctx.redbird.localEmails) return []
      return ctx.redbird.localEmails.list().map(({ html: _h, text: _t, ...e }) => e)
    }),

    get: adminProcedure.input(z.object({ id: z.string().uuid() })).query(({ ctx, input }) => {
      if (!ctx.redbird.localEmails)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Local email plugin not active' })
      const email = ctx.redbird.localEmails.get(input.id)
      if (!email) throw new TRPCError({ code: 'NOT_FOUND', message: 'Email not found' })
      return email
    }),

    clear: adminProcedure.mutation(({ ctx }) => {
      if (!ctx.redbird.localEmails)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Local email plugin not active' })
      ctx.redbird.localEmails.clear()
      return { ok: true }
    }),

    sendTest: adminProcedure.mutation(async ({ ctx }) => {
      if (!ctx.redbird.localEmails) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Email Local plugin not active. Install it from the Marketplace first.',
        })
      }
      const provider = ctx.redbird.email.default()
      if (!provider)
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No email provider active' })
      const storeName = ctx.redbird.config.storeName ?? 'Redbird Store'
      await provider.send({
        to: 'test@example.com',
        subject: `[Test] Email from ${storeName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
            <h2 style="margin:0 0 12px">📧 Test email</h2>
            <p>This is a test email sent from <strong>${storeName}</strong>.</p>
            <p>If you can read this in the Mailbox, your email plugin is working correctly.</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
            <p style="color:#6b7280;font-size:13px">Sent via Redbird backoffice — Mailbox test</p>
          </div>`,
        text: `Test email from ${storeName}. If you can read this, your email plugin is working.`,
      })
      return { ok: true }
    }),
  }),

  // ---- License ----
  license: router({
    status: adminProcedure.query(({ ctx }) => {
      const lic = ctx.redbird.license
      if (!lic) {
        return {
          valid: false as const,
          plan: 'free' as const,
          email: null,
          expiresAt: null,
          authorizedPlugins: [] as string[],
          message: ctx.redbird.config.licenseKey
            ? 'License key found but could not be verified.'
            : 'No license key configured.',
        }
      }
      return { ...lic, message: null }
    }),
  }),

  // ---- Multi-currency ----
  currency: router({
    get: adminProcedure.query(async ({ ctx }) => ctx.redbird.currency.getConfig()),
    setRates: adminProcedure
      .input(z.record(z.string().length(3), z.number().positive()))
      .mutation(async ({ ctx, input }) => {
        await ctx.redbird.currency.setRates(input)
        await writeAudit(ctx, 'currency.rates_update', 'store', undefined, { rates: input })
        return ctx.redbird.currency.getConfig()
      }),
  }),

  // ---- Demo data ----
  navigation: router({
    get: adminProcedure.query(async ({ ctx }) => {
      const row = await ctx.redbird.db.query.storeSettings.findFirst({
        where: eq(storeSettings.key, 'header_nav'),
      })
      return (row?.value as NavItem[] | null) ?? []
    }),
    set: adminProcedure
      .input(
        z.array(
          z.object({
            id: z.string(),
            label: z.string().min(1),
            type: z.enum(['category', 'page', 'custom']),
            value: z.string(),
            children: z
              .array(
                z.object({
                  id: z.string(),
                  label: z.string().min(1),
                  type: z.enum(['category', 'page', 'custom']),
                  value: z.string(),
                }),
              )
              .optional(),
          }),
        ),
      )
      .mutation(async ({ ctx, input }) => {
        await ctx.redbird.db
          .insert(storeSettings)
          .values({ key: 'header_nav', value: input, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: storeSettings.key,
            set: { value: input, updatedAt: new Date() },
          })
        return { ok: true }
      }),
  }),

  // ---- Accounting (FEC export) ----
  accounting: router({
    exportFec: adminProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const from = input?.from ? new Date(input.from) : null
        const to = input?.to ? new Date(`${input.to}T23:59:59.999Z`) : null
        const all = await ctx.redbird.orders.list({ limit: 10000 })
        const invoiced = all
          .filter((o) => o.invoiceNumber && o.invoicedAt)
          .filter((o) => {
            const d = new Date(o.invoicedAt as Date)
            if (from && d < from) return false
            if (to && d > to) return false
            return true
          })
          .sort(
            (a, b) =>
              new Date(a.invoicedAt as Date).getTime() - new Date(b.invoicedAt as Date).getTime(),
          )

        const entries: FecEntry[] = invoiced.map((o) => {
          const vat = o.taxAmount ?? 0
          const addr = o.shippingAddress as { firstName?: string; lastName?: string } | null
          const name = addr
            ? `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim()
            : (o.customerEmail ?? '')
          const issued = new Date(o.invoicedAt as Date)
          return {
            ecritureDate: issued,
            pieceRef: o.invoiceNumber as string,
            pieceDate: issued,
            label: `Facture ${o.invoiceNumber}`,
            auxNum: (o.customerId ?? o.id).replace(/-/g, '').slice(0, 17).toUpperCase(),
            auxLib: name || o.customerEmail || 'Client',
            netCents: o.totalAmount - vat,
            vatCents: vat,
            totalCents: o.totalAmount,
          }
        })

        return { fec: generateFec(entries), count: invoiced.length }
      }),
  }),

  seedDemo: adminProcedure.mutation(async ({ ctx }) => {
    const { seedDemoData } = await import('../seed.js')
    await seedDemoData(ctx.redbird, ctx.redbird.config.defaultCurrency)
    return { ok: true }
  }),

  // ---- Audit log — owner only, this is who-did-what-to-whom ----
  auditLog: router({
    list: ownerProcedure
      .input(
        z
          .object({
            entityType: z.string().optional(),
            entityId: z.string().optional(),
            action: z.string().optional(),
            before: z.string().datetime().optional(),
            limit: z.number().int().min(1).max(200).default(50),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const opts: Parameters<typeof ctx.redbird.auditLog.list>[0] = {
          limit: input?.limit ?? 50,
        }
        if (input?.entityType) opts.entityType = input.entityType
        if (input?.entityId) opts.entityId = input.entityId
        if (input?.action) opts.action = input.action
        if (input?.before) opts.before = new Date(input.before)
        return ctx.redbird.auditLog.list(opts)
      }),
  }),
})
