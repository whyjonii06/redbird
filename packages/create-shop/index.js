#!/usr/bin/env node
// create-redbird-shop — scaffolds a full Redbird store (API + storefront).
// Runs on an embedded database: no PostgreSQL, no Docker, no config.
// Zero dependencies: plain Node ESM so it runs via `npx` / `npm create`.

import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const templateDir = join(here, 'template')

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
}

async function main() {
  console.log(`\n  ${c.bold('🐦 create-redbird-shop')}\n`)

  let target = process.argv[2]
  if (!target) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    target = (await rl.question('  Project directory: ')).trim()
    rl.close()
  }
  if (!target) {
    console.error(c.red('  A project directory is required.'))
    process.exit(1)
  }

  const dest = resolve(process.cwd(), target)
  if (existsSync(dest) && (await readdir(dest)).length > 0) {
    console.error(c.red(`  ${target} already exists and is not empty.`))
    process.exit(1)
  }

  await mkdir(dest, { recursive: true })
  await cp(templateDir, dest, { recursive: true })

  // npm strips real dotfiles from published packages, so the template ships
  // them as `_env` / `_gitignore`. Restore them (root + web workspace).
  for (const dir of [dest, join(dest, 'web')]) {
    for (const [from, to] of [
      ['_gitignore', '.gitignore'],
      ['_env', '.env'],
    ]) {
      const src = join(dir, from)
      if (existsSync(src)) await rename(src, join(dir, to))
    }
  }

  // Personalise the project name.
  const pkgPath = join(dest, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  pkg.name = target.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  console.log(`  ${c.green('✓')} Created ${c.bold(target)}\n`)
  console.log('  Next steps:\n')
  console.log(`    cd ${target}`)
  console.log('    npm install')
  console.log('    npm run dev\n')
  console.log(c.dim('  → API on :3000 (embedded database, seeded) · storefront on :5173'))
  console.log(c.dim('  No database, no Docker, no config. You own 100% of the code.\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
