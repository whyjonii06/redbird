import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type Brand, brands } from '../db/schema.js'

export type { Brand }

export type CreateBrandInput = {
  name: string
  slug: string
  description?: string | undefined
  logoUrl?: string | undefined
  websiteUrl?: string | undefined
}

export type BrandService = {
  list(): Promise<Brand[]>
  get(id: string): Promise<Brand | null>
  getBySlug(slug: string): Promise<Brand | null>
  create(input: CreateBrandInput): Promise<Brand>
  update(id: string, patch: Partial<CreateBrandInput>): Promise<Brand>
  delete(id: string): Promise<void>
}

export function createBrandService(db: DbClient): BrandService {
  return {
    async list() {
      return db.query.brands.findMany({ orderBy: (b, { asc }) => [asc(b.name)] })
    },

    async get(id) {
      const row = await db.query.brands.findFirst({ where: eq(brands.id, id) })
      return row ?? null
    },

    async getBySlug(slug) {
      const row = await db.query.brands.findFirst({ where: eq(brands.slug, slug) })
      return row ?? null
    },

    async create(input) {
      const [brand] = await db
        .insert(brands)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          logoUrl: input.logoUrl ?? null,
          websiteUrl: input.websiteUrl ?? null,
        })
        .returning()
      if (!brand) throw new Error('Failed to create brand')
      return brand
    },

    async update(id, patch) {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.name !== undefined) set['name'] = patch.name
      if (patch.slug !== undefined) set['slug'] = patch.slug
      if (patch.description !== undefined) set['description'] = patch.description
      if (patch.logoUrl !== undefined) set['logoUrl'] = patch.logoUrl
      if (patch.websiteUrl !== undefined) set['websiteUrl'] = patch.websiteUrl

      const [updated] = await db
        .update(brands)
        .set(set)
        .where(eq(brands.id, id))
        .returning()
      if (!updated) throw new Error(`Brand ${id} not found`)
      return updated
    },

    async delete(id) {
      await db.delete(brands).where(eq(brands.id, id))
    },
  }
}
