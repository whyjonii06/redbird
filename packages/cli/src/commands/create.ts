import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const PACKAGE_JSON = (name: string) =>
  `${JSON.stringify(
    {
      name,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        '@redbirdshop/core': '^0.0.0',
        '@redbird/plugin-paypal': '^0.0.0',
        '@redbird/plugin-shipping-flat': '^0.0.0',
        '@redbird/plugin-stripe': '^0.0.0',
        next: '^15.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    },
    null,
    2,
  )}\n`

const REDBIRD_CONFIG = `import { defineConfig } from '@redbirdshop/core'
import { paypal } from '@redbird/plugin-paypal'
import { shippingFlat } from '@redbird/plugin-shipping-flat'
import { stripe } from '@redbird/plugin-stripe'

export default defineConfig({
  databaseUrl: process.env.DATABASE_URL!,
  defaultCurrency: 'EUR',
  defaultPaymentProvider: '@redbird/plugin-paypal',
  plugins: [
    // Payment providers — swap or add any provider, set defaultPaymentProvider above
    paypal({
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      sandbox: process.env.NODE_ENV !== 'production',
      dryRun: process.env.NODE_ENV !== 'production',
    }),
    stripe({
      secretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
      dryRun: process.env.NODE_ENV !== 'production',
    }),
    shippingFlat({
      zones: [
        { name: 'France', countries: ['FR'], rateAmount: 590, rateCurrency: 'EUR', freeOver: 5000 },
      ],
    }),
  ],
})
`

const ENV_EXAMPLE = `DATABASE_URL=postgres://redbird:redbird@localhost:5433/redbird

# Payment providers (both available, defaultPaymentProvider in redbird.config.ts sets the default)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
STRIPE_SECRET_KEY=sk_test_replace_me
`

const README = (name: string) => `# ${name}

A Redbird-powered storefront.

## Quick start

\`\`\`bash
pnpm install
docker compose up -d postgres   # if you don't have one running
forge seed                       # populate demo catalog
pnpm dev
\`\`\`
`

export async function cmdCreate(name: string | undefined): Promise<void> {
  if (!name) {
    process.stderr.write('forge create: missing app name\n  usage: forge create my-shop\n')
    process.exit(1)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    process.stderr.write(`forge create: invalid name "${name}" (lowercase, dashes only)\n`)
    process.exit(1)
  }

  const dir = resolve(process.cwd(), name)
  process.stdout.write(`\nCreating ${name}/ ...\n`)

  await mkdir(dir, { recursive: true })
  await writeFile(resolve(dir, 'package.json'), PACKAGE_JSON(name))
  await writeFile(resolve(dir, 'redbird.config.ts'), REDBIRD_CONFIG)
  await writeFile(resolve(dir, '.env.example'), ENV_EXAMPLE)
  await writeFile(resolve(dir, 'README.md'), README(name))

  process.stdout.write('  ✓ package.json\n')
  process.stdout.write('  ✓ redbird.config.ts\n')
  process.stdout.write('  ✓ .env.example\n')
  process.stdout.write('  ✓ README.md\n')
  process.stdout.write('\nNext steps:\n')
  process.stdout.write(`  cd ${name}\n`)
  process.stdout.write('  cp .env.example .env\n')
  process.stdout.write('  pnpm install\n')
  process.stdout.write('  pnpm dev\n\n')
}
