import type { AppRouter } from '@redbirdshop/api'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { getAdminKey, getStaffToken } from './auth.js'

export const trpc = createTRPCReact<AppRouter>()

export function makeTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers() {
          const headers: Record<string, string> = {}
          const adminKey = getAdminKey()
          if (adminKey) headers['x-admin-key'] = adminKey
          const staffToken = getStaffToken()
          if (staffToken) headers['x-staff-token'] = staffToken
          return headers
        },
      }),
    ],
  })
}

export function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
}

export function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
