import { type ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { de } from './de.js'
import { en } from './en.js'
import { es } from './es.js'
import { fr } from './fr.js'

export type Locale = 'en' | 'fr' | 'es' | 'de'

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
]

type Dict = Record<string, string>
const dicts: Record<Locale, Dict> = { en, fr, es, de }

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem('rb_locale')
    if (saved && saved in dicts) return saved as Locale
  } catch {}
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2)
  return (['en', 'fr', 'es', 'de'] as const).includes(nav as Locale) ? (nav as Locale) : 'en'
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

type I18nContextValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TranslateFn
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem('rb_locale', l)
    } catch {}
  }, [])

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      let s = dicts[locale][key] ?? en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return s
    },
    [locale],
  )

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
