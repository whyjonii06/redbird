import { and, eq } from 'drizzle-orm'
import type { ProductWithDetails } from '../catalog/service.js'
import type { DbClient } from '../db/client.js'
import { type ProductTranslation, productTranslations } from '../db/schema.js'

export type UpsertTranslationInput = {
  name: string
  description?: string | undefined
}

export type I18nService = {
  /** Set (or replace) a translation for a product locale. */
  upsert(
    productId: string,
    locale: string,
    input: UpsertTranslationInput,
  ): Promise<ProductTranslation>
  /** Get a single translation. Returns null if not found. */
  get(productId: string, locale: string): Promise<ProductTranslation | null>
  /** List all translations for a product. */
  list(productId: string): Promise<ProductTranslation[]>
  /** Delete a specific locale translation. */
  delete(productId: string, locale: string): Promise<void>
  /**
   * Apply a locale to a product: returns the product with name/description replaced
   * by the translation for the given locale. Falls back to the base product if no
   * translation exists for the locale. If a fallback locale is provided, tries it
   * before falling back to base.
   */
  translate(
    product: ProductWithDetails,
    locale: string,
    fallbackLocale?: string | undefined,
  ): ProductWithDetails
}

export function createI18nService(db: DbClient): I18nService {
  return {
    async upsert(productId, locale, input) {
      const [translation] = await db
        .insert(productTranslations)
        .values({
          productId,
          locale: locale.toLowerCase(),
          name: input.name,
          description: input.description ?? null,
        })
        .onConflictDoUpdate({
          target: [productTranslations.productId, productTranslations.locale],
          set: { name: input.name, description: input.description ?? null, updatedAt: new Date() },
        })
        .returning()
      if (!translation) throw new Error('Failed to upsert translation')
      return translation
    },

    async get(productId, locale) {
      const row = await db.query.productTranslations.findFirst({
        where: and(
          eq(productTranslations.productId, productId),
          eq(productTranslations.locale, locale.toLowerCase()),
        ),
      })
      return row ?? null
    },

    async list(productId) {
      return db.query.productTranslations.findMany({
        where: eq(productTranslations.productId, productId),
        orderBy: (t, { asc }) => [asc(t.locale)],
      })
    },

    async delete(productId, locale) {
      await db
        .delete(productTranslations)
        .where(
          and(
            eq(productTranslations.productId, productId),
            eq(productTranslations.locale, locale.toLowerCase()),
          ),
        )
    },

    translate(product, locale, fallbackLocale) {
      const find = (l: string) => product.translations?.find((t) => t.locale === l.toLowerCase())

      const t = find(locale) ?? (fallbackLocale ? find(fallbackLocale) : undefined)
      if (!t) return product

      return {
        ...product,
        name: t.name,
        description: t.description ?? product.description,
      }
    },
  }
}
