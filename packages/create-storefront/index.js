#!/usr/bin/env node
// create-redbird-storefront — scaffolds a standalone Redbird storefront.
// Zero dependencies: plain Node ESM so it runs via `npx` / `npm create`.

import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { dirname, join, resolve } from 'node:path'
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
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(`\n  ${c.bold('🐦 create-redbird-storefront')}\n`)

  let target = process.argv[2]
  if (!target) {
    target = (await rl.question('  Project directory: ')).trim()
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

  const apiUrl =
    (await rl.question(`  Redbird API URL ${c.dim('(http://localhost:3000)')}: `)).trim() ||
    'http://localhost:3000'

  rl.close()

  // Copy template
  await mkdir(dest, { recursive: true })
  await cp(templateDir, dest, { recursive: true })

  // Rename dotfile placeholders (npm strips real dotfiles from published packages)
  for (const [from, to] of [
    ['_gitignore', '.gitignore'],
    ['_env', '.env'],
  ]) {
    const src = join(dest, from)
    if (existsSync(src)) await rename(src, join(dest, to))
  }

  // Personalise package.json name
  const pkgPath = join(dest, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  pkg.name = target.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  // Write the chosen API URL into .env
  const envPath = join(dest, '.env')
  await writeFile(envPath, `VITE_REDBIRD_API_URL=${apiUrl}\n`)

  console.log(`\n  ${c.green('✓')} Created ${c.bold(target)}\n`)
  console.log('  Next steps:\n')
  console.log(`    cd ${target}`)
  console.log('    npm install')
  console.log('    npm run dev\n')
  console.log(c.dim(`  Talking to Redbird API at ${apiUrl}`))
  console.log(c.dim('  You own 100% of this code — edit, theme and deploy it anywhere.\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
