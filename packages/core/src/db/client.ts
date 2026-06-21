import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type DbClient =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>

export function isPgliteUrl(url?: string): boolean {
  return !url || url.startsWith('memory:') || url.startsWith('file:')
}

export function createDbClient(databaseUrl?: string): DbClient {
  if (isPgliteUrl(databaseUrl)) {
    // `file:./path` → PGlite expects a bare filesystem path (the `file:` scheme
    // prefix must be stripped, otherwise PGlite tries to mkdir it literally).
    const pg = databaseUrl?.startsWith('file:')
      ? new PGlite(databaseUrl.slice('file:'.length))
      : new PGlite()
    return drizzlePglite(pg, { schema, casing: 'snake_case' })
  }
  const sql = postgres(databaseUrl!, { max: 10, idle_timeout: 20, connect_timeout: 10 })
  return drizzlePg(sql, { schema, casing: 'snake_case' })
}
