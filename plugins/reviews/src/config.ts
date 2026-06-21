import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const REVIEWS_MODULE_NAME = '@redbird/plugin-reviews'

export type ReviewsConfig = {
  /** Publish new reviews immediately instead of holding them for moderation. */
  autoApprove: boolean
  /** Reject submissions below this star rating (1 = accept all). */
  minRating: number
}

const DEFAULTS: ReviewsConfig = { autoApprove: false, minRating: 1 }

/**
 * Reads this module's settings from `redbird.meta.json` (`pluginConfig`), the
 * same store the backoffice writes to via `admin.plugins.saveConfig`. Values
 * are persisted as strings, so they're coerced here.
 */
export function readReviewsConfig(): ReviewsConfig {
  try {
    const metaPath = resolve(process.cwd(), 'redbird.meta.json')
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
      pluginConfig?: Record<string, Record<string, string>>
    }
    const raw = meta.pluginConfig?.[REVIEWS_MODULE_NAME] ?? {}
    return {
      autoApprove: raw.autoApprove === 'true',
      minRating: clampRating(Number(raw.minRating)),
    }
  } catch {
    return DEFAULTS
  }
}

function clampRating(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1
  if (n > 5) return 5
  return Math.floor(n)
}
