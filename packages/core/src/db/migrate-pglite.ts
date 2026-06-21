import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle')

interface Journal {
  entries: Array<{ tag: string; when: number; breakpoints: boolean }>
}

export async function runPgliteMigrations(
  db: PgliteDatabase<Record<string, unknown>>,
): Promise<void> {
  // PGlite exposes exec() on the raw client — it uses the simple query protocol
  // which supports multiple statements in one call (unlike prepared statements).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pglite = (db as any).$client as { exec(sql: string): Promise<unknown> }

  // Ensure the Drizzle migrations tracking table exists (same schema as drizzle migrate())
  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)

  // Read already-applied migration tags
  const rows = await db.execute(
    sql`SELECT hash FROM "__drizzle_migrations" ORDER BY created_at`,
  )
  const applied = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((rows as any).rows as Array<{ hash: string }>).map((r) => r.hash),
  )

  // Read the Drizzle journal
  const journalPath = resolve(migrationsFolder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal

  for (const entry of journal.entries) {
    if (applied.has(entry.tag)) continue

    const sqlPath = resolve(migrationsFolder, `${entry.tag}.sql`)
    const sqlContent = readFileSync(sqlPath, 'utf8')

    // exec() handles multi-statement SQL files correctly
    await pglite.exec(sqlContent)

    await db.execute(
      sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${entry.tag}, ${Date.now()})`,
    )

    console.log(`  ✓ migration ${entry.tag}`)
  }
}
