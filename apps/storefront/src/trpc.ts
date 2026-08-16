import type { AppRouter } from '@redbirdshop/api-types'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { readLocalStorage } from './ssrSafe.js'

export const trpc = createTRPCReact<AppRouter>()

const apiBase = import.meta.env.VITE_API_URL ?? ''

/**
 * `baseUrl` is only ever passed by the SSR entry — a relative URL doesn't
 * resolve without a browser location. `token` likewise always passes `null`
 * there: SSR has no client localStorage to read a session from (see
 * AuthContext's own comment on why it doesn't try), so every server-rendered
 * page is anonymous, matching the client's own first hydration pass exactly.
 */
export function makeTRPCClient(opts?: { baseUrl?: string; token?: string | null }) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${opts?.baseUrl ?? apiBase}/trpc`,
        headers() {
          const token = opts?.token !== undefined ? opts.token : readLocalStorage('rb_token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}

export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}
