import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { DbClient } from './client.js'

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle')

export async function runPostgresMigrations(db: DbClient): Promise<void> {
  await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder })
}
