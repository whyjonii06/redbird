#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { cmdCreate } from './commands/create.js'
import { cmdInfo } from './commands/info.js'
import { cmdSeed } from './commands/seed.js'

const USAGE = `forge — the Redbird CLI

USAGE
  forge <command> [options]

COMMANDS
  info             Show engine status (db, plugins, catalog)
  seed             Populate the demo coffee catalog
  create <name>    Scaffold a new Redbird app
  help             Show this help

OPTIONS
  --database-url   Override DATABASE_URL (or use \$DATABASE_URL env)
  --help, -h       Show help

EXAMPLES
  $ forge info
  $ forge seed
  $ forge create my-shop
`

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      'database-url': { type: 'string' },
    },
  })

  const command = positionals[0]

  if (values.help || !command || command === 'help') {
    process.stdout.write(USAGE)
    return
  }

  const env = {
    databaseUrl:
      values['database-url'] ??
      process.env.DATABASE_URL ??
      'postgres://redbird:redbird@localhost:5433/redbird',
  }

  switch (command) {
    case 'info':
      await cmdInfo(env)
      break
    case 'seed':
      await cmdSeed(env)
      break
    case 'create':
      await cmdCreate(positionals[1])
      break
    default:
      process.stderr.write(`forge: unknown command "${command}"\n\n${USAGE}`)
      process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`forge: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
