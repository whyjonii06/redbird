import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, type Locale, dicts } from './config'

export { LOCALES, DEFAULT_LOCALE } from './config'
export type { Locale } from './config'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const v = store.get('rb_locale')?.value
  return v && v in dicts ? (v as Locale) : DEFAULT_LOCALE
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Server-side translator: reads the locale cookie and returns a `t()` bound to it. */
export async function getT(): Promise<TFn> {
  const locale = await getLocale()
  return (key, vars) => {
    let s = dicts[locale][key] ?? dicts[DEFAULT_LOCALE][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return s
  }
}
