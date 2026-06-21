// Packages each sellable storefront theme into a self-contained, deployable
// .zip served by the API for download. Run from the repo root:
//   node scripts/package-themes.mjs
//
// Workspace deps are rewritten to npm version ranges so the downloaded project
// installs standalone. node_modules/.next/dist are excluded.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'packages', 'api', 'themes')
mkdirSync(outDir, { recursive: true })

const THEMES = ['classic', 'editorial', 'b2b']
const EXCLUDE = new Set(['node_modules', '.next', 'dist', '.turbo'])
const EXCLUDE_FILES = new Set(['tsconfig.tsbuildinfo', 'next-env.d.ts'])

function walk(dir, base, acc = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name) || EXCLUDE_FILES.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, base, acc)
    else acc.push(full)
  }
  return acc
}

const README = (id) => `# Redbird Storefront — ${id}

A standalone Next.js storefront you own 100%. It talks to your Redbird store.

## Run

\`\`\`bash
npm install
cp .env.example .env   # set DATABASE_URL to your Redbird Postgres
npm run dev
\`\`\`

## Deploy

\`npm run build\` then deploy anywhere that runs Next.js (Vercel, your server…).
`

for (const id of THEMES) {
  const srcDir = join(root, 'apps', `storefront-${id}`)
  const zip = new JSZip()
  for (const file of walk(srcDir, srcDir)) {
    let rel = relative(srcDir, file).split('\\').join('/')
    let content = readFileSync(file)
    if (rel === 'package.json') {
      const pkg = JSON.parse(content.toString('utf8'))
      for (const field of ['dependencies', 'devDependencies']) {
        for (const k of Object.keys(pkg[field] ?? {})) {
          if (String(pkg[field][k]).startsWith('workspace:')) pkg[field][k] = '^0.1.0'
        }
      }
      pkg.name = `redbird-storefront-${id}`
      content = Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`)
    }
    // ship .gitignore as-is; rename if needed
    zip.file(rel, content)
  }
  zip.file(
    '.env.example',
    [
      '# Your Redbird Postgres database',
      'DATABASE_URL=postgres://redbird:redbird@localhost:5433/redbird',
      '',
      '# Optional: enable online payment via Stripe Checkout',
      '# STRIPE_SECRET_KEY=sk_live_...',
      '',
    ].join('\n'),
  )
  zip.file('README.md', README(id))
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const out = join(outDir, `${id}.zip`)
  writeFileSync(out, buf)
  console.log(`packaged ${id} → ${relative(root, out)} (${(buf.length / 1024).toFixed(1)} KB)`)
}
