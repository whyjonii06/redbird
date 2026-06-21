import type { AppRouter } from '@redbirdshop/api-types'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'

/**
 * Typed tRPC client for the Redbird API.
 *
 * The `AppRouter` type comes from `@redbirdshop/api-types`, giving you full
 * end-to-end type safety against your store's API — autocomplete every query,
 * never guess a response shape.
 */
export const trpc = createTRPCReact<AppRouter>()

/** Base URL of your Redbird API (set VITE_REDBIRD_API_URL in .env). */
export const API_URL = import.meta.env.VITE_REDBIRD_API_URL ?? 'http://localhost:3000'

export function makeTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers() {
          const token = localStorage.getItem('rb_token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}

/** Format minor-unit amounts (cents) as a localized currency string. */
export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}
