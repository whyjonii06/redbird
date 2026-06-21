import { type Redbird, createRedbird } from '@redbirdshop/core'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://redbird:redbird@localhost:5433/redbird'

// Avoid multiple instances during Next.js dev hot-reload.
declare global {
  // eslint-disable-next-line no-var
  var __redbird: Redbird | undefined
}

export const redbird: Redbird =
  globalThis.__redbird ??
  createRedbird({
    databaseUrl: DATABASE_URL,
    defaultCurrency: 'EUR',
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redbird = redbird
}
