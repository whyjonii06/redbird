import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'

const PRODUCTS = [
  {
    slug: 'ethiopia-yirgacheffe',
    name: 'Ethiopia Yirgacheffe',
    description:
      'Lavé et séché au soleil sur lits africains. Notes de jasmin, bergamote et thé noir.',
    image: 'https://picsum.photos/seed/redbird-coffee-1/800/800',
    variants: [
      { sku: 'YIR-250', name: '250g - Grains entiers', price: 1850 },
      { sku: 'YIR-1KG', name: '1kg - Grains entiers', price: 6500 },
    ],
  },
  {
    slug: 'colombia-geisha',
    name: 'Colombia Geisha',
    description: "Variété d'exception cultivée dans le Huila à 1850m. Floral, mangue et miel.",
    image: 'https://picsum.photos/seed/redbird-coffee-2/800/800',
    variants: [{ sku: 'COL-150', name: '150g - Grains entiers', price: 3200 }],
  },
  {
    slug: 'espresso-classico',
    name: 'Espresso Classico',
    description: 'Blend signature : 70% Brésil naturel, 30% Inde Robusta. Corps épais.',
    image: 'https://picsum.photos/seed/redbird-coffee-3/800/800',
    variants: [
      { sku: 'ESP-250', name: '250g - Grains entiers', price: 1290 },
      { sku: 'ESP-1KG', name: '1kg - Grains entiers', price: 4490 },
    ],
  },
  {
    slug: 'decaf-swiss-water',
    name: 'Décaféiné Swiss Water',
    description: "Décaféination à l'eau, sans solvant. Origine Pérou bio.",
    image: 'https://picsum.photos/seed/redbird-coffee-4/800/800',
    variants: [{ sku: 'DEC-250', name: '250g - Grains entiers', price: 1690 }],
  },
  {
    slug: 'hario-v60',
    name: 'Dripper Hario V60-02',
    description: 'Le classique japonais en céramique blanche. 1-4 tasses.',
    image: 'https://picsum.photos/seed/redbird-gear-1/800/800',
    variants: [{ sku: 'V60-CER', name: 'Céramique blanche', price: 2890 }],
  },
  {
    slug: 'comandante-c40',
    name: 'Moulin Comandante C40',
    description: 'Moulin manuel haut de gamme, lames Nitro Blade.',
    image: 'https://picsum.photos/seed/redbird-gear-2/800/800',
    variants: [{ sku: 'C40-BLACK', name: 'Noir mat', price: 28500 }],
  },
]

export async function cmdSeed({ databaseUrl }: { databaseUrl: string }): Promise<void> {
  const redbird = createRedbird({ databaseUrl, defaultCurrency: 'EUR' })

  process.stdout.write('🧹 Cleaning existing catalog...\n')
  await redbird.db.execute(
    sql`TRUNCATE TABLE cart_line_items, carts, order_line_items, orders, product_variants, products RESTART IDENTITY CASCADE`,
  )

  process.stdout.write('🌱 Seeding products...\n')
  for (const p of PRODUCTS) {
    await redbird.catalog.createProduct(
      {
        slug: p.slug,
        name: p.name,
        description: p.description,
        status: 'active',
        metadata: { image: p.image },
      },
      p.variants.map((v) => ({
        sku: v.sku,
        name: v.name,
        priceAmount: v.price,
        priceCurrency: 'EUR',
        inventoryQuantity: 100,
      })),
    )
    const n = p.variants.length
    process.stdout.write(`  ✓ ${p.slug} (${n} variant${n > 1 ? 's' : ''})\n`)
  }

  const all = await redbird.catalog.listProducts({ limit: 100 })
  process.stdout.write(`\n✅ Seed complete — ${all.length} products in catalog\n`)

  const client = redbird.db as unknown as { $client: { end: () => Promise<void> } }
  await client.$client.end()
}
