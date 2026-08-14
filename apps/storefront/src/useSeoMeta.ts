import { useEffect } from 'react'

export type SeoMetaOptions = {
  title: string
  description?: string | undefined
  ogType?: string
  ogImage?: string | undefined
  jsonLd?: Record<string, unknown>
}

function setMetaTag(nameOrProp: string, content: string, isProp = false): void {
  const attr = isProp ? 'property' : 'name'
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${nameOrProp}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, nameOrProp)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Document title, description/OG meta, canonical link and (optional) JSON-LD
 * for the current page. One instance of each tag is reused/updated across
 * navigations rather than appended, so an SPA route change doesn't pile up
 * duplicate <meta>/<script> tags in <head>.
 */
export function useSeoMeta(opts: SeoMetaOptions | undefined): void {
  // Options are usually built inline in the caller (new object every render),
  // so depend on their serialized form rather than object identity.
  const key = opts ? JSON.stringify(opts) : ''

  // biome-ignore lint/correctness/useExhaustiveDependencies: depend on the serialized `key`, not `opts` identity
  useEffect(() => {
    if (!opts) return

    document.title = opts.title
    setMetaTag('og:title', opts.title, true)
    setMetaTag('og:type', opts.ogType ?? 'website', true)
    if (opts.description) {
      setMetaTag('description', opts.description)
      setMetaTag('og:description', opts.description, true)
    }
    if (opts.ogImage) setMetaTag('og:image', opts.ogImage, true)

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', window.location.href.split('?')[0] ?? window.location.href)

    const existingLd = document.getElementById('redbird-page-ld')
    existingLd?.remove()
    if (opts.jsonLd) {
      const ldScript = document.createElement('script')
      ldScript.type = 'application/ld+json'
      ldScript.id = 'redbird-page-ld'
      ldScript.text = JSON.stringify(opts.jsonLd)
      document.head.appendChild(ldScript)
    }
  }, [key])
}
