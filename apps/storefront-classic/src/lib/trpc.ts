import type { AppRouter } from '@redbirdshop/api-types'
import { createTRPCClient, httpBatchLink } from '@trpc/client'

// The only thing this theme knows about Redbird — a base URL. No database
// connection, no core package import: everything goes over the network,
// exactly like a third-party client would.
const API_URL = process.env.REDBIRD_API_URL ?? 'http://localhost:3000/trpc'

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: API_URL })],
})
