import { QueryClient, dehydrate } from '@tanstack/react-query'
import { getQueryKey } from '@trpc/react-query'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App.js'
import { HeadContext } from './HeadContext.js'
import { detectLocale } from './i18n/index.js'
import { DEFAULT_META, type StoreMeta } from './meta.js'
import { makeTRPCClient, trpc } from './trpc.js'
import type { SeoMetaOptions } from './useSeoMeta.js'

export type RenderResult = { html: string; headHtml: string }

/**
 * Renders one request's HTML on the server. Everything here is scoped to
 * this single call — a fresh QueryClient/trpcClient per request, never a
 * module-scope singleton — so concurrent requests from different visitors
 * never share cache or state.
 *
 * Always renders as an anonymous visitor: AuthContext itself always starts
 * logged-out on the client's first hydration pass too (see its own comment —
 * this app's session lives in localStorage, which SSR can't read, and a
 * from-cookie personalized render would just mismatch a client that's about
 * to un-personalize itself anyway). Real personalization kicks in client-side
 * immediately after mount, same as it does without SSR at all today.
 */
export async function render(url: string, opts: { apiBaseUrl: string }): Promise<RenderResult> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  const trpcClient = makeTRPCClient({ baseUrl: opts.apiBaseUrl, token: null })

  const [initialMeta] = await Promise.all([
    fetchMetaServerSide(opts.apiBaseUrl),
    prefetchRouteData(url, queryClient, trpcClient, opts.apiBaseUrl),
  ])

  const headData: Partial<SeoMetaOptions> = {}
  const headCollector = { set: (o: SeoMetaOptions) => Object.assign(headData, o) }

  const html = renderToString(
    <StrictMode>
      <HeadContext.Provider value={headCollector}>
        <StaticRouter location={url}>
          <App queryClient={queryClient} trpcClient={trpcClient} initialMeta={initialMeta} />
        </StaticRouter>
      </HeadContext.Provider>
    </StrictMode>,
  )

  // Both are embedded so the client's first render matches the server's
  // exactly: same store meta (else the hydration diff below would fire for
  // every single field App reads from it) and the same query cache (else
  // catalog.bySlug/categories.bySlug/catalog.filter would silently refetch
  // over the network right after a response that already contained them).
  const stateScript = `<script>window.__INITIAL_META__=${serializeForScript(initialMeta)};window.__REACT_QUERY_STATE__=${serializeForScript(dehydrate(queryClient))}</script>`

  return { html, headHtml: `${buildHeadHtml(headData, initialMeta)}\n    ${stateScript}` }
}

/** JSON.stringify, but safe to embed in a <script> tag (escapes '</' so it can't close the tag early). */
function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

async function fetchMetaServerSide(apiBaseUrl: string): Promise<StoreMeta> {
  try {
    const res = await fetch(`${apiBaseUrl}/meta.json`)
    if (!res.ok) return DEFAULT_META
    const data = (await res.json()) as Partial<StoreMeta>
    return {
      ...DEFAULT_META,
      ...data,
      branding: { ...DEFAULT_META.branding, ...data.branding },
      featureFlags: { ...DEFAULT_META.featureFlags, ...data.featureFlags },
    }
  } catch {
    return DEFAULT_META
  }
}

/**
 * Prefetches the primary content query for the SEO-critical routes (product,
 * category) so their real content — not just a loading skeleton — is in the
 * first HTML response. Every other route still renders for real (App itself
 * is always server-rendered), just without a bespoke prefetch: it shows the
 * same loading state server-side that it would client-side before data
 * arrives, which is honest and correct, just not data-complete on first byte.
 *
 * Locale comes from the same detectLocale() the I18nProvider itself will
 * call when App renders — using anything else would build a query key the
 * component's own useQuery call can never match. There's no per-visitor
 * localStorage preference to read server-side either way, so this is exactly
 * what the client would compute on a fresh visit.
 */
async function prefetchRouteData(
  url: string,
  queryClient: QueryClient,
  trpcClient: ReturnType<typeof makeTRPCClient>,
  _apiBaseUrl: string,
): Promise<void> {
  const path = url.split('?')[0] ?? url
  const locale = detectLocale()

  const productMatch = path.match(/^\/products\/([^/]+)\/?$/)
  if (productMatch?.[1]) {
    const slug = decodeURIComponent(productMatch[1])
    await queryClient.prefetchQuery({
      queryKey: getQueryKey(trpc.catalog.bySlug, { slug, locale }, 'query'),
      queryFn: () => trpcClient.catalog.bySlug.query({ slug, locale }),
    })
    return
  }

  const categoryMatch = path.match(/^\/category\/([^/]+)\/?$/)
  if (categoryMatch?.[1]) {
    const slug = decodeURIComponent(categoryMatch[1])
    await queryClient.prefetchQuery({
      queryKey: getQueryKey(trpc.categories.bySlug, { slug, locale }, 'query'),
      queryFn: () => trpcClient.categories.bySlug.query({ slug, locale }),
    })
    const category = queryClient.getQueryData<{ id: string }>(
      getQueryKey(trpc.categories.bySlug, { slug, locale }, 'query'),
    )
    if (category?.id) {
      // Mirrors CategoryPage's first-render query input exactly (same default
      // filter state) so the cache key matches and the client hydrates a hit
      // instead of refetching.
      const filterInput = {
        categoryId: category.id,
        limit: 12,
        offset: 0,
        sortBy: 'newest' as const,
        brandIds: undefined,
        attributeValueIds: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        locale,
      }
      await queryClient.prefetchQuery({
        queryKey: getQueryKey(trpc.catalog.filter, filterInput, 'query'),
        queryFn: () => trpcClient.catalog.filter.query(filterInput),
      })
    }
  }
}

/** Builds the <title>/<meta>/<link rel=canonical>/JSON-LD to splice into <head>. */
function buildHeadHtml(headData: Partial<SeoMetaOptions>, meta: StoreMeta): string {
  const title = headData.title ?? meta.storeName
  const tags: string[] = [`<title>${escapeHtml(title)}</title>`]
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`)
  tags.push(`<meta property="og:type" content="${escapeHtml(headData.ogType ?? 'website')}" />`)
  if (headData.description) {
    tags.push(`<meta name="description" content="${escapeHtml(headData.description)}" />`)
    tags.push(`<meta property="og:description" content="${escapeHtml(headData.description)}" />`)
  }
  if (headData.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(headData.ogImage)}" />`)
  }
  if (headData.jsonLd) {
    // JSON.stringify output is safe inside a <script> as long as we escape '</'
    // sequences, which would otherwise prematurely close the tag.
    const json = JSON.stringify(headData.jsonLd).replace(/</g, '\\u003c')
    tags.push(`<script type="application/ld+json" id="redbird-page-ld">${json}</script>`)
  }
  return tags.join('\n    ')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
