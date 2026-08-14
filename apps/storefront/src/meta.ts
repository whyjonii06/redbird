export type StoreMeta = {
  storeName: string
  currency: string
  stripePublicKey: string | null
  theme: 'classic' | 'editorial' | 'lookbook' | 'minimal'
  /** How to display prices on the storefront. Default: 'none' (no tax label). */
  priceDisplay: 'incl_tax' | 'excl_tax' | 'none'
  branding: {
    logoUrl?: string
    tagline?: string
    contactEmail?: string
    primaryColor: string
    // Design tokens (no-code theming) — override the active theme's defaults
    bgColor?: string
    surfaceColor?: string
    textColor?: string
    mutedColor?: string
    borderColor?: string
    fontHeading?: string
    fontBody?: string
    radius?: string
  }
  /** Feature flags evaluated for this visitor (stable per anon id — see anonId()). */
  featureFlags: Record<string, boolean>
}

export const DEFAULT_META: StoreMeta = {
  storeName: 'My Store',
  currency: 'EUR',
  stripePublicKey: null,
  theme: 'classic',
  priceDisplay: 'none',
  branding: { primaryColor: '#4f46e5' },
  featureFlags: {},
}

/** Stable per-browser id so a partial feature-flag rollout doesn't flicker across page loads. */
function anonId(): string {
  try {
    const key = 'rb_anon_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

export async function fetchMeta(): Promise<StoreMeta> {
  try {
    const res = await fetch(`/meta.json?anon=${encodeURIComponent(anonId())}`)
    if (res.ok) {
      const data = (await res.json()) as Partial<StoreMeta>
      return {
        ...DEFAULT_META,
        ...data,
        branding: { ...DEFAULT_META.branding, ...data.branding },
        featureFlags: { ...DEFAULT_META.featureFlags, ...data.featureFlags },
      }
    }
  } catch {}
  return DEFAULT_META
}

const THEME_DEFAULTS: Record<string, string> = {
  classic: '#4f46e5',
  editorial: '#b3552c',
  minimal: '#111111',
}

export function applyMeta(meta: StoreMeta) {
  document.documentElement.setAttribute('data-theme', meta.theme)
  const root = document.documentElement
  const b = meta.branding

  const primary = b.primaryColor ?? THEME_DEFAULTS[meta.theme] ?? '#4f46e5'
  root.style.setProperty('--primary', primary)

  // No-code design tokens — set as inline CSS vars on :root, which override the
  // active theme's defaults. Only applied when the merchant has customised them.
  const tokenVars: Record<string, string | undefined> = {
    '--bg': b.bgColor,
    '--surface': b.surfaceColor,
    '--text': b.textColor,
    '--muted': b.mutedColor,
    '--border': b.borderColor,
    '--font-body': b.fontBody,
    '--font-heading': b.fontHeading,
    '--radius': b.radius,
  }
  for (const [name, value] of Object.entries(tokenVars)) {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }
  // Flag so the stylesheet knows custom tokens are active and can wire base
  // background/text/font/radius regardless of the chosen base theme.
  const hasCustomTokens = Boolean(
    b.bgColor ||
      b.surfaceColor ||
      b.textColor ||
      b.mutedColor ||
      b.borderColor ||
      b.fontBody ||
      b.fontHeading ||
      b.radius,
  )
  if (hasCustomTokens) root.setAttribute('data-custom-theme', '')
  else root.removeAttribute('data-custom-theme')

  document.title = meta.storeName
}

/** Set page-level SEO meta tags. Pass null to reset to store defaults. */
export function setPageMeta(opts: {
  title?: string | null
  description?: string | null
  imageUrl?: string | null
  storeName?: string
}) {
  if (opts.title) {
    document.title = opts.storeName ? `${opts.title} — ${opts.storeName}` : opts.title
  } else if (opts.storeName) {
    document.title = opts.storeName
  }

  setMeta('description', opts.description ?? null)
  setOg('og:title', opts.title ?? null)
  setOg('og:description', opts.description ?? null)
  setOg('og:image', opts.imageUrl ?? null)
  setOg('og:type', opts.title ? 'product' : 'website')
}

function setMeta(name: string, content: string | null) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

function setOg(property: string, content: string | null) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.content = content
}
