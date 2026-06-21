'use client'

import { LOCALES, type Locale } from '@/i18n/config'
import { useRouter } from 'next/navigation'

export function LanguageSwitcher({ locale, className }: { locale: Locale; className?: string }) {
  const router = useRouter()

  function change(next: string) {
    document.cookie = `rb_locale=${next};path=/;max-age=31536000;samesite=lax`
    router.refresh()
  }

  return (
    <select
      value={locale}
      onChange={(e) => change(e.target.value)}
      aria-label="Language"
      className={
        className ?? 'bg-transparent font-mono text-xs text-slate outline-none hover:text-teal'
      }
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.code.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
