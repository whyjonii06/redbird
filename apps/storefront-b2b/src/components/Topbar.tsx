import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getLocale, getT } from '@/i18n'
import { getCart } from '@/lib/cart'
import Link from 'next/link'

export async function Topbar() {
  const cart = await getCart()
  const items = cart?.lineItems.reduce((s, li) => s + li.quantity, 0) ?? 0
  const t = await getT()
  const locale = await getLocale()

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-3 lg:px-10">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-graphite">Redbird</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-teal">/ Pro</span>
        </Link>

        <nav className="hidden items-center gap-1 text-xs md:flex">
          <NavLink href="/">{t('nav.quickOrder')}</NavLink>
          <NavLink href="/catalog">{t('nav.catalogue')}</NavLink>
          <NavLink href="/account">{t('nav.monCompte')}</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <form action="/catalog" className="hidden items-center md:flex">
            <input
              name="q"
              type="search"
              placeholder={t('nav.searchPlaceholder')}
              aria-label={t('nav.searchPlaceholder')}
              className="w-40 border border-line bg-white px-2 py-1.5 font-mono text-xs text-graphite outline-none focus:border-teal"
            />
          </form>
          <LanguageSwitcher locale={locale} />
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 border border-line bg-surface-alt px-3 py-1.5 text-xs font-medium text-graphite transition-colors hover:border-teal hover:text-teal"
          >
            {t('nav.panier')}
            <span className="inline-block min-w-5 rounded-sm bg-teal px-1.5 py-0.5 text-center font-mono text-[11px] text-white tabular">
              {items}
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
      href={href}
      className="px-3 py-1.5 text-graphite transition-colors hover:bg-surface-alt hover:text-teal"
    >
      {children}
    </Link>
  )
}
