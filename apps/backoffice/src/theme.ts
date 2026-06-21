export type Theme = 'dark' | 'light'

const KEY = 'redbird_bo_theme'
const THEMES: Theme[] = ['dark', 'light']

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY) as Theme | null
  return stored && THEMES.includes(stored) ? stored : 'dark'
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement
  root.classList.remove(...THEMES.map((th) => `theme-${th}`))
  if (t !== 'dark') root.classList.add(`theme-${t}`)
}

export function setTheme(t: Theme): void {
  localStorage.setItem(KEY, t)
  applyTheme(t)
}

export function initTheme(): void {
  applyTheme(getTheme())
}
