import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type Brand,
  type Category,
  type CategoryTranslation,
  type NewCategory,
  type Product,
  type ProductFeature,
  type ProductImage,
  type ProductTranslation,
  type ProductVariant,
  type StockLevel,
  brands,
  categories,
  productCategories,
  productFeatures,
  productImages,
  productTranslations,
  productVariants,
  products,
  stockLevels,
  variantAttributeValues,
} from '../db/schema.js'
import type { PluginRegistry } from '../plugins/registry.js'
import type { VariantAttributeValueWithRelations } from './service.js'

export type CategoryWithTranslations = Category & { translations: CategoryTranslation[] }

export type CategoryService = {
  list(opts?: {
    parentId?: string | null | undefined
  }): Promise<CategoryWithTranslations[]>
  getBySlug(slug: string): Promise<CategoryWithTranslations | null>
  getById(id: string): Promise<CategoryWithTranslations | null>
  create(input: NewCategory): Promise<Category>
  update(id: string, patch: Partial<Omit<NewCategory, 'id'>>): Promise<Category>
  delete(id: string): Promise<void>
  assignProduct(productId: string, categoryId: string): Promise<void>
  unassignProduct(productId: string, categoryId: string): Promise<void>
  listProducts(
    categoryId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<
    Array<
      Product & {
        brand: Brand | null
        variants: (ProductVariant & {
          stockLevel: StockLevel | null
          attributeValues: VariantAttributeValueWithRelations[]
        })[]
        images: ProductImage[]
        translations: ProductTranslation[]
        features: ProductFeature[]
      }
    >
  >
}

export function createCategoryService(db: DbClient, hooks: PluginRegistry): CategoryService {
  return {
    async list({ parentId } = {}) {
      return db.query.categories.findMany({
        where:
          parentId !== undefined
            ? parentId === null
              ? isNull(categories.parentId)
              : eq(categories.parentId, parentId)
            : undefined,
        orderBy: (c, { asc }) => [asc(c.name)],
        with: { translations: true },
      })
    },

    async getBySlug(slug) {
      const row = await db.query.categories.findFirst({
        where: eq(categories.slug, slug),
        with: { translations: true },
      })
      return row ?? null
    },

    async getById(id) {
      const row = await db.query.categories.findFirst({
        where: eq(categories.id, id),
        with: { translations: true },
      })
      return row ?? null
    },

    async create(input) {
      const [category] = await db.insert(categories).values(input).returning()
      if (!category) throw new Error('Failed to create category')
      await hooks.emit('category.created', { category })
      return category
    },

    async update(id, patch) {
      const [category] = await db
        .update(categories)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning()
      if (!category) throw new Error(`Category ${id} not found`)
      await hooks.emit('category.updated', { category })
      return category
    },

    async delete(id) {
      const deleted = await db.delete(categories).where(eq(categories.id, id)).returning()
      if (deleted.length === 0) throw new Error(`Category ${id} not found`)
      await hooks.emit('category.deleted', { categoryId: id })
    },

    async assignProduct(productId, categoryId) {
      await db.insert(productCategories).values({ productId, categoryId }).onConflictDoNothing()
    },

    async unassignProduct(productId, categoryId) {
      await db
        .delete(productCategories)
        .where(
          and(
            eq(productCategories.productId, productId),
            eq(productCategories.categoryId, categoryId),
          ),
        )
    },

    async listProducts(categoryId, { limit = 20, offset = 0 } = {}) {
      const rows = await db
        .select()
        .from(products)
        .innerJoin(productCategories, eq(productCategories.productId, products.id))
        .where(eq(productCategories.categoryId, categoryId))
        .limit(limit)
        .offset(offset)
        .orderBy(products.createdAt)

      if (rows.length === 0) return []

      const productIds = rows.map((r) => r.products.id)
      const brandIds = [
        ...new Set(rows.map((r) => r.products.brandId).filter((id): id is string => id !== null)),
      ]
      const [allVariants, allImages, allTranslations, allBrands, allFeatures] = await Promise.all([
        db.query.productVariants.findMany({
          where: inArray(productVariants.productId, productIds),
        }),
        db.query.productImages.findMany({
          where: inArray(productImages.productId, productIds),
          orderBy: [asc(productImages.position), asc(productImages.createdAt)],
        }),
        db.query.productTranslations.findMany({
          where: inArray(productTranslations.productId, productIds),
        }),
        brandIds.length > 0
          ? db.select().from(brands).where(inArray(brands.id, brandIds))
          : Promise.resolve([] as Brand[]),
        db.query.productFeatures.findMany({
          where: inArray(productFeatures.productId, productIds),
          orderBy: [asc(productFeatures.position)],
        }),
      ])

      const variantIds = allVariants.map((v) => v.id)
      const stockByVariant = new Map<string, StockLevel>()
      const avRowsByVariant = new Map<string, VariantAttributeValueWithRelations[]>()
      if (variantIds.length > 0) {
        const [stocks, avRows] = await Promise.all([
          db.query.stockLevels.findMany({
            where: inArray(stockLevels.variantId, variantIds),
          }),
          db.query.variantAttributeValues.findMany({
            where: inArray(variantAttributeValues.variantId, variantIds),
            with: { attributeValue: { with: { attribute: true } } },
          }),
        ])
        for (const s of stocks) stockByVariant.set(s.variantId, s)
        for (const av of avRows) {
          const existing = avRowsByVariant.get(av.variantId)
          const entry: VariantAttributeValueWithRelations = {
            variantId: av.variantId,
            attributeValueId: av.attributeValueId,
            attributeValue: av.attributeValue
              ? { ...av.attributeValue, attribute: av.attributeValue.attribute }
              : null,
          }
          if (existing) {
            existing.push(entry)
          } else {
            avRowsByVariant.set(av.variantId, [entry])
          }
        }
      }

      const brandById = new Map(allBrands.map((b) => [b.id, b]))
      return rows.map((r) => ({
        ...r.products,
        brand: r.products.brandId ? (brandById.get(r.products.brandId) ?? null) : null,
        variants: allVariants
          .filter((v) => v.productId === r.products.id)
          .map((v) => ({
            ...v,
            stockLevel: stockByVariant.get(v.id) ?? null,
            attributeValues: avRowsByVariant.get(v.id) ?? [],
          })),
        images: allImages.filter((img) => img.productId === r.products.id),
        translations: allTranslations.filter((t) => t.productId === r.products.id),
        features: allFeatures.filter((f) => f.productId === r.products.id),
      }))
    },
  }
}
