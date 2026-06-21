// Client-safe i18n config (no next/headers) — importable from client components.
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'

export type Locale = 'en' | 'fr' | 'es' | 'de'

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
]

// French is the theme's source language → fallback locale.
export const DEFAULT_LOCALE: Locale = 'fr'

export const dicts: Record<Locale, Record<string, string>> = { en, fr, es, de }
