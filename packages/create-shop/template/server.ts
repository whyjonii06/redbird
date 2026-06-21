import { createApiServer } from '@redbirdshop/api'
import { createRedbird } from '@redbirdshop/core'

// Embedded in-memory database by default (PGlite) — no PostgreSQL, no Docker,
// no setup. Data is reseeded on each start; set DATABASE_URL to a Postgres
// connection string when you want persistence / production.
const redbird = createRedbird({
  storeName: 'My Redbird Store',
  defaultCurrency: 'EUR',
  ...(process.env.DATABASE_URL ? { databaseUrl: process.env.DATABASE_URL } : {}),
})

await redbird.init() // creates + migrates the database automatically

// Seed a few demo products on first run so the store isn't empty.
const existing = await redbird.catalog.listProducts({ limit: 1 })
if (existing.length === 0) {
  const demo = [
    { slug: 'ethiopia-250g', name: 'Ethiopia Yirgacheffe — 250g', sku: 'COF-ETH-250', price: 1490, description: 'Bright, floral single-origin coffee.' },
    { slug: 'colombia-250g', name: 'Colombia Huila — 250g', sku: 'COF-COL-250', price: 1390, description: 'Chocolate & caramel, full body.' },
    { slug: 'house-blend-1kg', name: 'House Blend — 1kg', sku: 'COF-HSE-1000', price: 3990, description: 'Our everyday espresso blend.' },
  ]
  for (const d of demo) {
    await redbird.catalog.createProduct(
      { slug: d.slug, name: d.name, status: 'active', description: d.description },
      [{ sku: d.sku, name: 'Default', priceAmount: d.price, priceCurrency: 'EUR' }],
    )
    const product = await redbird.catalog.getProductBySlug(d.slug)
    const variant = product?.variants[0]
    if (variant) await redbird.stock.set(variant.id, 100)
  }
  console.log('  ✓ Seeded demo products')
}

const server = createApiServer({
  redbird,
  port: Number(process.env.PORT) || 3000,
  adminKey: process.env.ADMIN_KEY || 'dev-admin-key',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
})
await server.listen()

console.log(`\n  Redbird API → http://localhost:${server.port}`)
console.log('  Storefront  → http://localhost:5173\n')
