import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { licenses } from './schema.js'

const DB_PATH = process.env['DATABASE_PATH'] ?? './license.db'
const sqlite = new Database(DB_PATH)

export const db = drizzle(sqlite, { schema: { licenses } })

// Auto-migrate on startup
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'pro',
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
