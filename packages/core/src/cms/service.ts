import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type CmsPage, type CmsTranslation, type NewCmsPage, cmsPages } from '../db/schema.js'

export type CmsPageWithTranslations = CmsPage & { translations: CmsTranslation[] }

export type CmsService = {
  list(opts?: { publishedOnly?: boolean }): Promise<CmsPageWithTranslations[]>
  getBySlug(slug: string): Promise<CmsPageWithTranslations | null>
  getById(id: string): Promise<CmsPageWithTranslations | null>
  create(input: Omit<NewCmsPage, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmsPage>
  update(
    id: string,
    patch: Partial<Omit<NewCmsPage, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CmsPage>
  delete(id: string): Promise<void>
}

export function createCmsService(db: DbClient): CmsService {
  return {
    async list({ publishedOnly = false } = {}) {
      return db.query.cmsPages.findMany({
        where: publishedOnly ? eq(cmsPages.published, true) : undefined,
        orderBy: (p, { asc }) => [asc(p.position), asc(p.title)],
        with: { translations: true },
      })
    },

    async getBySlug(slug) {
      const row = await db.query.cmsPages.findFirst({
        where: eq(cmsPages.slug, slug),
        with: { translations: true },
      })
      return row ?? null
    },

    async getById(id) {
      const row = await db.query.cmsPages.findFirst({
        where: eq(cmsPages.id, id),
        with: { translations: true },
      })
      return row ?? null
    },

    async create(input) {
      const [page] = await db.insert(cmsPages).values(input).returning()
      if (!page) throw new Error('Failed to create CMS page')
      return page
    },

    async update(id, patch) {
      const [page] = await db
        .update(cmsPages)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(cmsPages.id, id))
        .returning()
      if (!page) throw new Error(`CMS page ${id} not found`)
      return page
    },

    async delete(id) {
      const deleted = await db.delete(cmsPages).where(eq(cmsPages.id, id)).returning()
      if (deleted.length === 0) throw new Error(`CMS page ${id} not found`)
    },
  }
}
