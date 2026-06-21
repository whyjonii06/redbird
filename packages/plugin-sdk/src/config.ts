import type { z } from 'zod'

/**
 * Parse and validate a plugin's config object against a Zod schema.
 * Throws a clear error if validation fails.
 *
 * @example
 * const schema = z.object({ apiKey: z.string().min(1) })
 * const config = defineConfig(schema, userInput)
 */
export function defineConfig<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(
      `Plugin config invalid:\n${result.error.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`,
    )
  }
  return result.data
}
