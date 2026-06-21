import { and, eq, ilike, inArray, or } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type AttributeValue,
  type NewProduct,
  type NewProductVariant,
  type Product,
  type ProductAttribute,
  type ProductFeature,
  type ProductImage,
  type ProductRelation,
  type ProductTranslation,
  type ProductVariant,
  type StockLevel,
  productRelations,
  productVariants,
  products,
} from '../db/schema.js'
import type { PluginRegistry } from '../plugins/registry.js'

export type VariantAttributeValueWithRelations = {
  variantId: string
  attributeValueId: string
  attributeValue: (AttributeValue & { attribute: ProductAttribute }) | null
}

export type ProductWithDetails = Product & {
  brand: import('../db/schema.js').Brand | null
  variants: (ProductVariant & {
    stockLevel: StockLevel | null
    attributeValues: VariantAttributeValueWithRelations[]
  })[]
  images: ProductImage[]
  translations: ProductTranslation[]
  features: ProductFeature[]
}

export type CatalogService = {
  listProducts(opts?: {
    limit?: number | undefined
    offset?: number | undefined
    status?: Product['status'] | undefined
    sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'name' | undefined
  }): Promise<ProductWithDetails[]>
  search(
    q: string,
    opts?: {
      limit?: number | undefined
      status?: Product['status'] | undefined
    },
  ): Promise<ProductWithDetails[]>
  countProducts(opts?: { status?: Product['status'] | undefined }): Promise<number>
  getProductBySlug(slug: string): Promise<ProductWithDetails | null>
  getProductById(id: string): Promise<ProductWithDetails | null>
  createProduct(
    input: NewProduct,
    variants?: Array<Omit<NewProductVariant, 'productId'>>,
  ): Promise<Product>
  updateProduct(id: string, patch: Partial<NewProduct>): Promise<Product>
  deleteProduct(id: string): Promise<void>
  addVariant(input: NewProductVariant): Promise<ProductVariant>
  updateVariant(
    id: string,
    patch: Partial<Pick<NewProductVariant, 'sku' | 'name' | 'priceAmount' | 'priceCurrency'>>,
  ): Promise<ProductVariant>
  deleteVariant(id: string): Promise<void>
  listRelations(
    productId: string,
    opts?: { type?: ProductRelation['type'] },
  ): Promise<Array<ProductRelation & { relatedProduct: ProductWithDetails | null }>>
  addRelation(
    productId: string,
    relatedProductId: string,
    type?: ProductRelation['type'],
  ): Promise<ProductRelation>
  removeRelation(id: string): Promise<void>
}

export function createCatalogService(db: DbClient, hooks: PluginRegistry): CatalogService {
  return {
    async listProducts({ limit = 20, offset = 0, status, sortBy } = {}) {
      return db.query.products.findMany({
        where: status ? eq(products.status, status) : undefined,
        with: {
          brand: true,
          variants: { with: { stockLevel: true, attributeValues: { with: { attributeValue: { with: { attribute: true } } } } } },
          images: { orderBy: (img, { asc }) => [asc(img.position), asc(img.createdAt)] },
          translations: true,
          features: { orderBy: (f, { asc }) => [asc(f.position)] },
        },
        limit,
        offset,
        orderBy: sortBy === 'name'
          ? (p, { asc }) => [asc(p.name)]
          : (p, { desc }) => [desc(p.createdAt)],
      })
    },

    async search(q, { limit = 20, status = 'active' } = {}) {
      const term = `%${q}%`
      return db.query.products.findMany({
        where: and(
          status ? eq(products.status, status) : undefined,
          or(
            ilike(products.name, term),
            ilike(products.description, term),
            ilike(products.slug, term),
          ),
        ),
        with: {
          brand: true,
          variants: { with: { stockLevel: true, attributeValues: { with: { attributeValue: { with: { attribute: true } } } } } },
          images: { orderBy: (img, { asc }) => [asc(img.position), asc(img.createdAt)] },
          translations: true,
          features: { orderBy: (f, { asc }) => [asc(f.position)] },
        },
        limit,
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      })
    },

    async countProducts({ status } = {}) {
      return db.$count(products, status ? eq(products.status, status) : undefined)
    },

    async getProductBySlug(slug) {
      const row = await db.query.products.findFirst({
        where: eq(products.slug, slug),
        with: {
          brand: true,
          variants: { with: { stockLevel: true, attributeValues: { with: { attributeValue: { with: { attribute: true } } } } } },
          images: { orderBy: (img, { asc }) => [asc(img.position), asc(img.createdAt)] },
          translations: true,
          features: { orderBy: (f, { asc }) => [asc(f.position)] },
        },
      })
      return row ?? null
    },

    async getProductById(id) {
      const row = await db.query.products.findFirst({
        where: eq(products.id, id),
        with: {
          brand: true,
          variants: { with: { stockLevel: true, attributeValues: { with: { attributeValue: { with: { attribute: true } } } } } },
          images: { orderBy: (img, { asc }) => [asc(img.position), asc(img.createdAt)] },
          translations: true,
          features: { orderBy: (f, { asc }) => [asc(f.position)] },
        },
      })
      return row ?? null
    },

    async createProduct(input, variantInputs = []) {
      const [product] = await db.insert(products).values(input).returning()
      if (!product) throw new Error('Failed to create product')

      if (variantInputs.length > 0) {
        await db
          .insert(productVariants)
          .values(variantInputs.map((v) => ({ ...v, productId: product.id })))
      }

      await hooks.emit('product.created', { product })
      return product
    },

    async updateProduct(id, patch) {
      const [product] = await db
        .update(products)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning()
      if (!product) throw new Error(`Product ${id} not found`)
      await hooks.emit('product.updated', { product })
      return product
    },

    async deleteProduct(id) {
      const deleted = await db.delete(products).where(eq(products.id, id)).returning()
      if (deleted.length === 0) throw new Error(`Product ${id} not found`)
      await hooks.emit('product.deleted', { productId: id })
    },

    async addVariant(input) {
      const [variant] = await db.insert(productVariants).values(input).returning()
      if (!variant) throw new Error('Failed to create variant')
      await hooks.emit('variant.created', { variant })
      return variant
    },

    async updateVariant(id, patch) {
      const [variant] = await db
        .update(productVariants)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(productVariants.id, id))
        .returning()
      if (!variant) throw new Error(`Variant ${id} not found`)
      return variant
    },

    async deleteVariant(id) {
      const deleted = await db.delete(productVariants).where(eq(productVariants.id, id)).returning()
      if (deleted.length === 0) throw new Error(`Variant ${id} not found`)
    },

    async listRelations(productId, opts = {}) {
      const rels = await db.query.productRelations.findMany({
        where: (r, { eq: eqFn, and: andFn }) =>
          opts.type
            ? andFn(eqFn(r.productId, productId), eqFn(r.type, opts.type!))
            : eqFn(r.productId, productId),
        orderBy: (r, { asc }) => [asc(r.position), asc(r.createdAt)],
      })
      if (rels.length === 0) return []
      const relatedIds = rels.map((r) => r.relatedProductId)
      const prods = await db.query.products.findMany({
        where: (p, { inArray: inArr }) => inArr(p.id, relatedIds),
        with: {
          brand: true,
          variants: { with: { stockLevel: true, attributeValues: { with: { attributeValue: { with: { attribute: true } } } } } },
          images: { orderBy: (img, { asc }) => [asc(img.position), asc(img.createdAt)] },
          translations: true,
          features: { orderBy: (f, { asc }) => [asc(f.position)] },
        },
      })
      const prodById = new Map(prods.map((p) => [p.id, p as ProductWithDetails]))
      return rels.map((r) => ({ ...r, relatedProduct: prodById.get(r.relatedProductId) ?? null }))
    },

    async addRelation(productId, relatedProductId, type = 'related') {
      const [rel] = await db
        .insert(productRelations)
        .values({ productId, relatedProductId, type })
        .onConflictDoNothing()
        .returning()
      if (!rel) {
        const existing = await db.query.productRelations.findFirst({
          where: (r, { eq: eqFn, and: andFn }) =>
            andFn(
              eqFn(r.productId, productId),
              eqFn(r.relatedProductId, relatedProductId),
              eqFn(r.type, type),
            ),
        })
        if (existing) return existing
        throw new Error('Failed to add relation')
      }
      return rel
    },

    async removeRelation(id) {
      await db.delete(productRelations).where(eq(productRelations.id, id))
    },
  }
}

// Re-export query helper for advanced callers
export { and, eq }
