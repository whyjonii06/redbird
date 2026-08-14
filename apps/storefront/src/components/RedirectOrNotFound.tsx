import { Navigate, useLocation } from 'react-router-dom'
import { trpc } from '../trpc.js'

/**
 * Renders `fallback` (the page's own "not found" UI) unless a redirect is
 * configured for the current path, in which case it navigates there instead.
 * Used both by the catch-all 404 route and by pages whose slug lookup can
 * fail on its own route (e.g. /products/:slug renders ProductPage even for
 * an unknown slug — it never falls through to the catch-all route at all).
 *
 * This is a client-side navigation (no SSR here), so it doesn't emit a real
 * HTTP 301/302 to crawlers — it gets visitors and JS-following crawlers to
 * the new URL instead of a dead end. A reverse proxy is still the right
 * place for true server-side redirects if that matters for your SEO setup.
 */
export function RedirectOrNotFound({ fallback }: { fallback: React.ReactNode }) {
  const { pathname } = useLocation()
  const { data: redirect, isLoading } = trpc.redirects.lookup.useQuery({ path: pathname })

  if (isLoading) return null

  if (redirect) {
    if (redirect.toPath.includes('://')) {
      window.location.replace(redirect.toPath)
      return null
    }
    return <Navigate to={redirect.toPath} replace />
  }

  return <>{fallback}</>
}
