import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { adminProcedure, publicProcedure, router } from '../trpc.js'

const localeInput = z.string().min(2).max(10).optional()

export const cmsRouter = router({
  list: publicProcedure
    .input(z.object({ locale: localeInput }).optional())
    .query(async ({ ctx, input }) => {
      const pages = await ctx.redbird.cms.list({ publishedOnly: true })
      return input?.locale
        ? pages.map((p) => ctx.redbird.cmsI18n.translate(p, input.locale as string))
        : pages
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1), locale: localeInput }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.redbird.cms.getBySlug(input.slug)
      if (!page || !page.published) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Page "${input.slug}" not found` })
      }
      return input.locale ? ctx.redbird.cmsI18n.translate(page, input.locale) : page
    }),

  // ---- Theme sections (storefront reads these) ----
  themeSections: router({
    list: publicProcedure
      .input(z.object({ theme: z.string() }))
      .query(async ({ ctx, input }) => ctx.redbird.themeSections.listByTheme(input.theme)),

    // Admin: full CRUD
    upsert: adminProcedure
      .input(
        z.object({
          id: z.string().uuid().optional(),
          theme: z.string(),
          sectionType: z.string(),
          position: z.number().int().min(0).default(0),
          config: z.record(z.unknown()).default({}),
          isActive: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...rest } = input
        return ctx.redbird.themeSections.upsert(id ? { id, ...rest } : rest)
      }),

    reorder: adminProcedure
      .input(z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })))
      .mutation(async ({ ctx, input }) => {
        await Promise.all(
          input.map(({ id, position }) => ctx.redbird.themeSections.updatePosition(id, position)),
        )
      }),

    setActive: adminProcedure
      .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) =>
        ctx.redbird.themeSections.setActive(input.id, input.isActive),
      ),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.themeSections.delete(input.id)),

    seedDefaults: adminProcedure
      .input(z.object({ theme: z.string() }))
      .mutation(async ({ ctx, input }) => ctx.redbird.themeSections.seedDefaults(input.theme)),
  }),
})
