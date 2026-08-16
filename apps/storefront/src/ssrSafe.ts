/** localStorage doesn't exist under Node SSR — reading it during render (rather than
 * inside an effect/event handler) must degrade to null instead of throwing. */
export function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
