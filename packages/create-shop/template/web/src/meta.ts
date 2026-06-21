import { API_URL } from './trpc'

/** Store metadata served by the Redbird API at /meta.json. */
export type StoreMeta = {
  storeName: string
  currency: string
  branding: { primaryColor?: string }
}

const DEFAULT_META: StoreMeta = {
  storeName: 'My Store',
  currency: 'EUR',
  branding: { primaryColor: '#4f46e5' },
}

export async function fetchMeta(): Promise<StoreMeta> {
  try {
    const res = await fetch(`${API_URL}/meta.json`)
    if (res.ok) {
      const data = (await res.json()) as Partial<StoreMeta>
      return { ...DEFAULT_META, ...data, branding: { ...DEFAULT_META.branding, ...data.branding } }
    }
  } catch {}
  return DEFAULT_META
}

export function applyBranding(meta: StoreMeta) {
  if (meta.branding.primaryColor) {
    document.documentElement.style.setProperty('--primary', meta.branding.primaryColor)
  }
  document.title = meta.storeName
}
