import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type CmsPage, type CmsTranslation, cmsTranslations } from '../db/schema.js'

export type UpsertCmsTranslationInput = {
  title: string
  excerpt?: string | undefined
  content: string
}

export type CmsI18nService = {
  upsert(pageId: string, locale: string, input: UpsertCmsTranslationInput): Promise<CmsTranslation>
  get(pageId: string, locale: string): Promise<CmsTranslation | null>
  list(pageId: string): Promise<CmsTranslation[]>
  delete(pageId: string, locale: string): Promise<void>
  /** Apply a locale to a CMS page, falling back to the base row if no translation exists. */
  translate<T extends CmsPage & { translations?: CmsTranslation[] }>(
    page: T,
    locale: string,
    fallbackLocale?: string | undefined,
  ): T
}

export function createCmsI18nService(db: DbClient): CmsI18nService {
  return {
    async upsert(pageId, locale, input) {
      const [translation] = await db
        .insert(cmsTranslations)
        .values({
          pageId,
          locale: locale.toLowerCase(),
          title: input.title,
          excerpt: input.excerpt ?? null,
          content: input.content,
        })
        .onConflictDoUpdate({
          target: [cmsTranslations.pageId, cmsTranslations.locale],
          set: {
            title: input.title,
            excerpt: input.excerpt ?? null,
            content: input.content,
            updatedAt: new Date(),
          },
        })
        .returning()
      if (!translation) throw new Error('Failed to upsert CMS translation')
      return translation
    },

    async get(pageId, locale) {
      const row = await db.query.cmsTranslations.findFirst({
        where: and(
          eq(cmsTranslations.pageId, pageId),
          eq(cmsTranslations.locale, locale.toLowerCase()),
        ),
      })
      return row ?? null
    },

    async list(pageId) {
      return db.query.cmsTranslations.findMany({
        where: eq(cmsTranslations.pageId, pageId),
        orderBy: (t, { asc }) => [asc(t.locale)],
      })
    },

    async delete(pageId, locale) {
      await db
        .delete(cmsTranslations)
        .where(
          and(eq(cmsTranslations.pageId, pageId), eq(cmsTranslations.locale, locale.toLowerCase())),
        )
    },

    translate(page, locale, fallbackLocale) {
      const find = (l: string) => page.translations?.find((t) => t.locale === l.toLowerCase())
      const t = find(locale) ?? (fallbackLocale ? find(fallbackLocale) : undefined)
      if (!t) return page
      return { ...page, title: t.title, excerpt: t.excerpt ?? page.excerpt, content: t.content }
    },
  }
}
