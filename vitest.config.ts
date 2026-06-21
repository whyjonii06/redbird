import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'plugins/**/*.test.ts', 'tests-integration/**/*.test.ts'],
    globals: false,
    // Integration tests hit a shared Postgres — serialize file execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
  },
})
