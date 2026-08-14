import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type Category, type CategoryTranslation, categoryTranslations } from '../db/schema.js'

export type UpsertCategoryTranslationInput = {
  name: string
  description?: string | undefined
}

export type CategoryI18nService = {
  upsert(
    categoryId: string,
    locale: string,
    input: UpsertCategoryTranslationInput,
  ): Promise<CategoryTranslation>
  get(categoryId: string, locale: string): Promise<CategoryTranslation | null>
  list(categoryId: string): Promise<CategoryTranslation[]>
  delete(categoryId: string, locale: string): Promise<void>
  /** Apply a locale to a category, falling back to the base row if no translation exists. */
  translate<T extends Category & { translations?: CategoryTranslation[] }>(
    category: T,
    locale: string,
    fallbackLocale?: string | undefined,
  ): T
}

export function createCategoryI18nService(db: DbClient): CategoryI18nService {
  return {
    async upsert(categoryId, locale, input) {
      const [translation] = await db
        .insert(categoryTranslations)
        .values({
          categoryId,
          locale: locale.toLowerCase(),
          name: input.name,
          description: input.description ?? null,
        })
        .onConflictDoUpdate({
          target: [categoryTranslations.categoryId, categoryTranslations.locale],
          set: { name: input.name, description: input.description ?? null, updatedAt: new Date() },
        })
        .returning()
      if (!translation) throw new Error('Failed to upsert category translation')
      return translation
    },

    async get(categoryId, locale) {
      const row = await db.query.categoryTranslations.findFirst({
        where: and(
          eq(categoryTranslations.categoryId, categoryId),
          eq(categoryTranslations.locale, locale.toLowerCase()),
        ),
      })
      return row ?? null
    },

    async list(categoryId) {
      return db.query.categoryTranslations.findMany({
        where: eq(categoryTranslations.categoryId, categoryId),
        orderBy: (t, { asc }) => [asc(t.locale)],
      })
    },

    async delete(categoryId, locale) {
      await db
        .delete(categoryTranslations)
        .where(
          and(
            eq(categoryTranslations.categoryId, categoryId),
            eq(categoryTranslations.locale, locale.toLowerCase()),
          ),
        )
    },

    translate(category, locale, fallbackLocale) {
      const find = (l: string) => category.translations?.find((t) => t.locale === l.toLowerCase())
      const t = find(locale) ?? (fallbackLocale ? find(fallbackLocale) : undefined)
      if (!t) return category
      return { ...category, name: t.name, description: t.description ?? category.description }
    },
  }
}
