import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMeta } from '../App.js'
import { useAuth } from '../AuthContext.js'
import { useCartData } from '../CartContext.js'
import { useCurrency } from '../CurrencyContext.js'
import { useWishlist } from '../WishlistContext.js'
import { LOCALES, useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'

type NavItem = {
  id: string
  label: string
  labels?: Record<string, string>
  type: 'category' | 'page' | 'custom'
  value: string
  children?: Omit<NavItem, 'children'>[]
}

function navLabel(item: Pick<NavItem, 'label' | 'labels'>, locale: string): string {
  return item.labels?.[locale] ?? item.label
}

function navHref(item: Pick<NavItem, 'type' | 'value'>): string {
  if (item.type === 'custom' && item.value.includes('://')) return item.value
  return item.value
}

function NavLink({ item, locale }: { item: NavItem; locale: string }) {
  const hasChildren = (item.children?.length ?? 0) > 0
  const href = navHref(item)
  const external = item.type === 'custom' && item.value.includes('://')

  const linkClass =
    'text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1'

  if (!hasChildren) {
    return external ? (
      <a href={href} className={linkClass} target="_blank" rel="noreferrer">
        {navLabel(item, locale)}
      </a>
    ) : (
      <Link to={href} className={linkClass}>
        {navLabel(item, locale)}
      </Link>
    )
  }

  return (
    <div className="relative group">
      <span className={`${linkClass} cursor-default`}>
        {navLabel(item, locale)}
        <svg
          aria-hidden="true"
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
      <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          {item.children!.map((child) => (
            <Link
              key={child.id}
              to={navHref(child)}
              className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              {navLabel(child, locale)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Header() {
  const meta = useMeta()
  const { customer } = useAuth()
  const { data: cart } = useCartData()
  const { ids: wishlistIds } = useWishlist()
  const { t, locale, setLocale } = useI18n()
  const { currency, setCurrency, supported } = useCurrency()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const { data: navItems = [] } = trpc.navigation.get.useQuery()

  const itemCount = cart?.lineItems.reduce((n, li) => n + li.quantity, 0) ?? 0
  const cartHasItems = itemCount > 0

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {meta.branding.logoUrl ? (
            <img src={meta.branding.logoUrl} alt={meta.storeName} className="h-8 w-auto" />
          ) : (
            <span className="font-bold text-lg text-gray-900">{meta.storeName}</span>
          )}
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-5">
          {navItems.length > 0 ? (
            (navItems as NavItem[]).map((item) => (
              <NavLink key={item.id} item={item} locale={locale} />
            ))
          ) : (
            <Link
              to="/products"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('header.products')}
            </Link>
          )}
        </nav>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-auto">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              className="w-full border border-gray-300 rounded-full px-4 py-1.5 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </button>
          </div>
        </form>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          {/* Wishlist */}
          <button
            type="button"
            onClick={() => navigate('/wishlist')}
            className="relative text-gray-600 hover:text-gray-900"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            {wishlistIds.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {wishlistIds.length}
              </span>
            )}
          </button>

          {/* Account */}
          {customer ? (
            <Link
              to="/account"
              className="text-gray-600 hover:text-gray-900"
              title={customer.email}
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              {t('header.login')}
            </Link>
          )}

          {/* Language switcher */}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number]['code'])}
            aria-label="Language"
            className="text-sm bg-transparent text-gray-600 hover:text-gray-900 outline-none cursor-pointer"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.code.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Currency switcher — locked while the cart has items already priced
              in another currency, to avoid a cart mixing currencies silently. */}
          {supported.length > 1 && (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={cartHasItems}
              aria-label="Currency"
              title={cartHasItems ? 'Clear your cart to switch currency' : undefined}
              className="text-sm bg-transparent text-gray-600 hover:text-gray-900 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {supported.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}

          {/* Cart */}
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="relative flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
            {t('header.cart')}
            {itemCount > 0 && (
              <span
                className="absolute -top-2 -right-3 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
