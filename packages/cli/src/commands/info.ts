import { VERSION, createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
}

export async function cmdInfo({ databaseUrl }: { databaseUrl: string }): Promise<void> {
  process.stdout.write(`\n${C.bold(C.red('●'))} ${C.bold('redbird')} ${C.dim(`v${VERSION}`)}\n\n`)

  process.stdout.write(`  ${C.dim('database')}  ${maskUrl(databaseUrl)}\n`)

  const redbird = createRedbird({ databaseUrl, defaultCurrency: 'EUR' })

  let connected = false
  let counts = { products: 0, variants: 0, carts: 0, orders: 0 }
  try {
    const result = (await redbird.db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products)::int AS products,
        (SELECT COUNT(*) FROM product_variants)::int AS variants,
        (SELECT COUNT(*) FROM carts)::int AS carts,
        (SELECT COUNT(*) FROM orders)::int AS orders
    `)) as unknown as { rows?: Record<string, number>[] } | Record<string, number>[]
    const row = Array.isArray(result) ? result[0] : (result?.rows?.[0] ?? null)
    if (row) {
      counts = {
        products: row.products ?? 0,
        variants: row.variants ?? 0,
        carts: row.carts ?? 0,
        orders: row.orders ?? 0,
      }
    }
    connected = true
  } catch (err) {
    void err
  }

  process.stdout.write(
    `  ${C.dim('status  ')}  ${connected ? C.green('● connected') : C.red('● unreachable')}\n\n`,
  )

  if (connected) {
    const fmt = (n: number) => String(n).padStart(6, ' ')
    process.stdout.write(`  ${C.cyan('CATALOG')}\n`)
    process.stdout.write(`    ${C.dim('products ')}  ${fmt(counts.products)}\n`)
    process.stdout.write(`    ${C.dim('variants ')}  ${fmt(counts.variants)}\n`)
    process.stdout.write(`    ${C.dim('carts    ')}  ${fmt(counts.carts)}\n`)
    process.stdout.write(`    ${C.dim('orders   ')}  ${fmt(counts.orders)}\n`)
  } else {
    process.stdout.write(
      `  ${C.yellow('!')} Database unreachable. Start it with: ${C.bold('docker compose up -d postgres')}\n`,
    )
  }
  process.stdout.write('\n')

  const client = redbird.db as unknown as { $client: { end: () => Promise<void> } }
  await client.$client.end()
}

function maskUrl(url: string): string {
  return url.replace(/(:[^:@/]+)@/, ':***@')
}
