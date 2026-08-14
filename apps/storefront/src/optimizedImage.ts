/**
 * Product images can be either self-hosted (`/uploads/...`, served by the
 * API's on-the-fly resize endpoint — see packages/api/src/server.ts) or an
 * arbitrary external URL (Unsplash, a CDN...). Only the former can be
 * resized/reformatted by us, so these helpers no-op on anything else.
 */
function isOptimizable(url: string): boolean {
  return url.includes('/uploads/')
}

export function optimizedSrc(url: string, width: number, format: 'webp' | 'avif' = 'webp'): string {
  if (!isOptimizable(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${width}&fmt=${format}`
}

export function optimizedSrcSet(url: string, widths: number[]): string | undefined {
  if (!isOptimizable(url)) return undefined
  return widths.map((w) => `${optimizedSrc(url, w)} ${w}w`).join(', ')
}
