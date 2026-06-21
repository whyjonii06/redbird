import { type Redbird, createRedbird } from '@redbirdshop/core'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://redbird:redbird@localhost:5433/redbird'

declare global {
  // eslint-disable-next-line no-var
  var __redbird_b2b: Redbird | undefined
}

export const redbird: Redbird =
  globalThis.__redbird_b2b ?? createRedbird({ databaseUrl: DATABASE_URL, defaultCurrency: 'EUR' })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redbird_b2b = redbird
}
