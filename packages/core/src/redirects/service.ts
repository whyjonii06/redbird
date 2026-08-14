import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type NewRedirect, type Redirect, redirects } from '../db/schema.js'

export type CreateRedirectInput = {
  fromPath: string
  toPath: string
  statusCode?: '301' | '302' | undefined
}

export type UpdateRedirectInput = {
  fromPath?: string
  toPath?: string
  statusCode?: '301' | '302'
  active?: boolean
}

export type RedirectService = {
  list(): Promise<Redirect[]>
  create(input: CreateRedirectInput): Promise<Redirect>
  update(id: string, patch: UpdateRedirectInput): Promise<Redirect>
  delete(id: string): Promise<void>
  /** Active redirect for an exact path, or null. Path must start with "/". */
  findByPath(fromPath: string): Promise<Redirect | null>
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function createRedirectService(db: DbClient): RedirectService {
  return {
    async list() {
      return db.query.redirects.findMany({ orderBy: (r, { desc }) => [desc(r.createdAt)] })
    },

    async create(input) {
      const fromPath = normalizePath(input.fromPath)
      // toPath may be an absolute URL (external destination) or a relative path —
      // only normalize+compare when it looks like a path, so this can't corrupt
      // an absolute URL by prefixing it with a stray "/".
      if (!input.toPath.includes('://') && fromPath === normalizePath(input.toPath)) {
        throw new Error('A redirect cannot point to itself')
      }
      const values: NewRedirect = { fromPath, toPath: input.toPath }
      if (input.statusCode !== undefined) values.statusCode = input.statusCode
      const [redirect] = await db.insert(redirects).values(values).returning()
      if (!redirect) throw new Error('Failed to create redirect')
      return redirect
    },

    async update(id, patch) {
      const setValues: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.fromPath !== undefined) setValues.fromPath = normalizePath(patch.fromPath)
      if (patch.toPath !== undefined) setValues.toPath = patch.toPath
      if (patch.statusCode !== undefined) setValues.statusCode = patch.statusCode
      if (patch.active !== undefined) setValues.active = patch.active
      const [redirect] = await db
        .update(redirects)
        .set(setValues)
        .where(eq(redirects.id, id))
        .returning()
      if (!redirect) throw new Error(`Redirect ${id} not found`)
      return redirect
    },

    async delete(id) {
      const deleted = await db.delete(redirects).where(eq(redirects.id, id)).returning()
      if (deleted.length === 0) throw new Error(`Redirect ${id} not found`)
    },

    async findByPath(fromPath) {
      const row = await db.query.redirects.findFirst({
        where: eq(redirects.fromPath, normalizePath(fromPath)),
      })
      return row?.active ? row : null
    },
  }
}
