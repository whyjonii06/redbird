import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getLocale, getT } from '@/i18n'
import { getCart } from '@/lib/cart'
import Link from 'next/link'

export async function Masthead() {
  const cart = await getCart()
  const items = cart?.lineItems.reduce((s, li) => s + li.quantity, 0) ?? 0
  const t = await getT()
  const locale = await getLocale()

  return (
    <header className="border-b border-coal-rule">
      {/* Top strip — issue meta */}
      <div className="border-b border-coal-rule bg-coal-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-2 text-[10px] uppercase tracking-[0.25em] text-ivory-muted lg:px-12">
          <span>Vol. XXVII</span>
          <span>—</span>
          <span>Juin 2026</span>
          <span className="hidden md:inline">—</span>
          <span className="hidden md:inline tabular">N° 027</span>
          <span className="ml-auto text-ruby">Édition courante</span>
        </div>
      </div>

      {/* Big masthead */}
      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-12">
        <Link href="/" className="block">
          <h1 className="font-serif text-[clamp(3.5rem,11vw,11rem)] font-medium leading-[0.85] tracking-tight text-ivory">
            Redbird<span className="text-ruby">.</span>
            <span className="ml-4 italic text-ivory-muted">Cahier</span>
          </h1>
        </Link>
        <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-coal-rule pt-5 text-xs uppercase tracking-[0.25em] text-ivory-muted lg:flex-row lg:items-center">
          <span>Café · Spécialité · Origine unique · Torréfacteur indépendant</span>
          <nav className="flex flex-wrap items-center gap-8">
            <NavLink href="/">{t('nav.sommaire')}</NavLink>
            <NavLink href="/products">{t('nav.index')}</NavLink>
            <NavLink href="/account">{t('nav.compte')}</NavLink>
            <form action="/products" className="flex items-center">
              <input
                name="q"
                type="search"
                placeholder={t('nav.searchPlaceholder')}
                aria-label={t('nav.searchPlaceholder')}
                className="w-36 border-b border-coal-rule bg-transparent py-1 text-[10px] uppercase tracking-[0.2em] text-ivory outline-none placeholder:text-ivory-muted focus:border-ruby"
              />
            </form>
            <LanguageSwitcher locale={locale} />
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 text-ruby transition-colors hover:text-saffron"
            >
              {t('nav.panier')} ({items})
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative inline-block text-ivory transition-colors duration-200 hover:text-ruby after:absolute after:bottom-[-4px] after:left-1/2 after:h-[2px] after:w-0 after:bg-ruby after:transition-all after:duration-300 hover:after:left-0 hover:after:w-full"
    >
      {children}
    </Link>
  )
}
