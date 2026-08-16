import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type NewTenant, type Tenant, tenants } from '../db/schema.js'

export type { Tenant, NewTenant }

export type TenantService = {
  create(input: { slug: string; name: string }): Promise<Tenant>
  get(id: string): Promise<Tenant | null>
  getBySlug(slug: string): Promise<Tenant | null>
  list(): Promise<Tenant[]>
  setStatus(id: string, status: Tenant['status']): Promise<Tenant>
}

export function createTenantService(db: DbClient): TenantService {
  return {
    async create(input) {
      const [tenant] = await db.insert(tenants).values({ slug: input.slug, name: input.name }).returning()
      if (!tenant) throw new Error('Failed to create tenant')
      return tenant
    },

    async get(id) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
      return tenant ?? null
    },

    async getBySlug(slug) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
      return tenant ?? null
    },

    async list() {
      return db.select().from(tenants).orderBy(tenants.createdAt)
    },

    async setStatus(id, status) {
      const [tenant] = await db
        .update(tenants)
        .set({ status, updatedAt: new Date() })
        .where(eq(tenants.id, id))
        .returning()
      if (!tenant) throw new Error('Tenant not found')
      return tenant
    },
  }
}
