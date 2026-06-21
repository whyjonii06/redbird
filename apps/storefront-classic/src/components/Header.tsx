import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getLocale, getT } from '@/i18n'
import { getCart } from '@/lib/cart'
import type { Route } from 'next'
import Link from 'next/link'

export async function Header() {
  const cart = await getCart()
  const itemCount = cart?.lineItems.reduce((sum, li) => sum + li.quantity, 0) ?? 0
  const t = await getT()
  const locale = await getLocale()

  return (
    <header className="relative z-10 border-b border-rule">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link
          href="/"
          className="font-display text-2xl font-medium tracking-tight text-ink hover:text-copper transition-colors"
        >
          Redbird Coffee<span className="text-copper">.</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm uppercase tracking-widest md:flex">
          <NavLink href="/">{t('nav.boutique')}</NavLink>
          <NavLink href="/products">{t('nav.catalogue')}</NavLink>
          <NavLink href="/account">{t('nav.compte')}</NavLink>
          <NavLink href="#">{t('nav.journal')}</NavLink>
        </nav>

        <form action="/products" className="hidden items-center md:flex">
          <input
            name="q"
            type="search"
            placeholder={t('nav.searchPlaceholder')}
            aria-label={t('nav.searchPlaceholder')}
            className="w-40 border-b border-rule bg-transparent py-1 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft focus:border-copper"
          />
        </form>

        <div className="flex items-center gap-5">
          <LanguageSwitcher locale={locale} />
          <Link
            href="/cart"
            className="group flex items-center gap-2 text-sm uppercase tracking-widest text-ink-soft transition-colors hover:text-copper"
          >
            <span>{t('nav.panier')}</span>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-xs text-paper transition-colors group-hover:bg-copper">
              {itemCount}
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className="relative inline-block text-ink-soft transition-colors duration-200 hover:text-copper after:absolute after:bottom-[-6px] after:left-0 after:h-px after:w-0 after:bg-copper after:transition-all after:duration-300 hover:after:w-full"
    >
      {children}
    </Link>
  )
}
