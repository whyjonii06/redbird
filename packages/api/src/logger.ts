import pino from 'pino'

export type Logger = pino.Logger

/**
 * Create the server logger.
 *
 * - NODE_ENV=test   → silent (no output in test suites)
 * - NODE_ENV=production → raw JSON to stdout (pipe to log aggregator)
 * - everything else  → pino-pretty for human-readable dev output
 *
 * Override level with LOG_LEVEL env var (trace|debug|info|warn|error|silent).
 */
export function createLogger(opts?: { level?: string }): Logger {
  const isTest = process.env.NODE_ENV === 'test'
  const isProd = process.env.NODE_ENV === 'production'
  const level = opts?.level ?? process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info')

  if (isTest) {
    return pino({ level: 'silent' })
  }

  if (isProd) {
    return pino({ level })
  }

  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageKey: 'msg',
      },
    },
  })
}
