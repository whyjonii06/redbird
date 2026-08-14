import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type FeatureFlag, featureFlags } from '../db/schema.js'

export type UpsertFeatureFlagInput = {
  enabled: boolean
  rolloutPercent?: number
  description?: string | undefined
}

export type FeatureFlagService = {
  list(): Promise<FeatureFlag[]>
  get(key: string): Promise<FeatureFlag | null>
  upsert(key: string, input: UpsertFeatureFlagInput): Promise<FeatureFlag>
  delete(key: string): Promise<void>
  /**
   * Evaluates a flag for a given anonymous/customer id: false if the flag
   * doesn't exist or is disabled, otherwise a deterministic bucket check
   * against rolloutPercent — the same id always gets the same result for a
   * given flag, so a partial rollout doesn't flicker per page load.
   */
  isEnabledFor(key: string, subjectId: string): Promise<boolean>
  /** Evaluate every known flag at once — used to build the storefront's public flag map. */
  evaluateAll(subjectId: string): Promise<Record<string, boolean>>
}

/** djb2 string hash, cheap and stable across Node versions — no crypto needed for bucketing. */
function bucketOf(key: string, subjectId: string): number {
  let hash = 5381
  const input = `${key}:${subjectId}`
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash) % 100
}

export function createFeatureFlagService(db: DbClient): FeatureFlagService {
  function evaluate(flag: FeatureFlag | null, subjectId: string): boolean {
    if (!flag || !flag.enabled) return false
    if (flag.rolloutPercent >= 100) return true
    if (flag.rolloutPercent <= 0) return false
    return bucketOf(flag.key, subjectId) < flag.rolloutPercent
  }

  return {
    async list() {
      return db.query.featureFlags.findMany({ orderBy: (f, { asc }) => [asc(f.key)] })
    },

    async get(key) {
      return (await db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) })) ?? null
    },

    async upsert(key, input) {
      const rolloutPercent = input.rolloutPercent ?? 100
      const [row] = await db
        .insert(featureFlags)
        .values({
          key,
          enabled: input.enabled,
          rolloutPercent,
          description: input.description ?? null,
        })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: {
            enabled: input.enabled,
            rolloutPercent,
            description: input.description ?? null,
            updatedAt: new Date(),
          },
        })
        .returning()
      if (!row) throw new Error('Failed to upsert feature flag')
      return row
    },

    async delete(key) {
      await db.delete(featureFlags).where(eq(featureFlags.key, key))
    },

    async isEnabledFor(key, subjectId) {
      const flag = await db.query.featureFlags.findFirst({ where: eq(featureFlags.key, key) })
      return evaluate(flag ?? null, subjectId)
    },

    async evaluateAll(subjectId) {
      const flags = await db.query.featureFlags.findMany()
      const result: Record<string, boolean> = {}
      for (const flag of flags) {
        result[flag.key] = evaluate(flag, subjectId)
      }
      return result
    },
  }
}
