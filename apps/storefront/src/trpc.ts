import type { AppRouter } from '@redbirdshop/api-types'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'

export const trpc = createTRPCReact<AppRouter>()

const apiBase = import.meta.env.VITE_API_URL ?? ''

export function makeTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${apiBase}/trpc`,
        headers() {
          const token = localStorage.getItem('rb_token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}

export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}
