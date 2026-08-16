import { createContext } from 'react'
import type { SeoMetaOptions } from './useSeoMeta.js'

/**
 * SSR-only channel for page head tags. `useEffect` never runs during
 * `renderToString`, so `useSeoMeta` can't rely on its usual DOM-mutation path
 * to get title/meta/JSON-LD into the response — instead, when this context is
 * provided (only entry-server.tsx provides it), the page's `useSeoMeta` call
 * writes here synchronously during render, and the server reads it back after
 * rendering to build the real <head>. Absent on the client (value stays
 * null), so hydration keeps using the original effect-based DOM path.
 */
export const HeadContext = createContext<{ set: (opts: SeoMetaOptions) => void } | null>(null)
