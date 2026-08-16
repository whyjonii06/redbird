import type { DehydratedState, QueryClient } from '@tanstack/react-query'
import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { AuthProvider } from './AuthContext.js'
import { CartProvider } from './CartContext.js'
import { CurrencyProvider } from './CurrencyContext.js'
import { WishlistProvider } from './WishlistContext.js'
import { Header } from './components/Header.js'
import { InstallPrompt } from './components/InstallPrompt.js'
import { RedirectOrNotFound } from './components/RedirectOrNotFound.js'
import { I18nProvider, useI18n } from './i18n/index.js'
import { DEFAULT_META, type StoreMeta, applyMeta, fetchMeta } from './meta.js'
import { AccountPage } from './pages/AccountPage.js'
import { AddressBookPage } from './pages/AddressBookPage.js'
import { CartPage } from './pages/CartPage.js'
import { CategoryPage } from './pages/CategoryPage.js'
import { CheckoutPage } from './pages/CheckoutPage.js'
import { CmsPageView } from './pages/CmsPageView.js'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js'
import { HomePage } from './pages/HomePage.js'
import { InvoicePage } from './pages/InvoicePage.js'
import { LoginPage } from './pages/LoginPage.js'
import { NotFoundPage } from './pages/NotFoundPage.js'
import { OrderConfirmPage } from './pages/OrderConfirmPage.js'
import { ProductPage } from './pages/ProductPage.js'
import { ProductsPage } from './pages/ProductsPage.js'
import { RegisterPage } from './pages/RegisterPage.js'
import { ResetPasswordPage } from './pages/ResetPasswordPage.js'
import { SearchPage } from './pages/SearchPage.js'
import { UnsubscribePage } from './pages/UnsubscribePage.js'
import { WishlistPage } from './pages/WishlistPage.js'
import { type makeTRPCClient, trpc } from './trpc.js'

const MetaContext = createContext<StoreMeta>(DEFAULT_META)
export function useMeta() {
  return useContext(MetaContext)
}

/** Reads a feature flag evaluated server-side for this visitor. Unknown/disabled flags are false. */
export function useFeatureFlag(key: string): boolean {
  return useContext(MetaContext).featureFlags[key] ?? false
}

function RedirectCategory() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/category/${slug ?? ''}`} replace />
}

export type AppProps = {
  queryClient: QueryClient
  trpcClient: ReturnType<typeof makeTRPCClient>
  /** Pre-fetched store meta for the very first render (SSR, or a client that
   * already has it dehydrated) — avoids a flash of DEFAULT_META while the
   * client-only effect below re-fetches it. */
  initialMeta?: StoreMeta | undefined
  /** Server-prefetched query cache (see entry-server.tsx) — hydrated into
   * `queryClient` so the client's first render reuses it instead of
   * refetching data the response already contained. */
  dehydratedState?: DehydratedState | undefined
}

/**
 * Assumes it's already inside a Router (BrowserRouter on the client,
 * StaticRouter for SSR) — the entry points own that choice, not App itself,
 * since the two environments need different Router implementations.
 */
export default function App({ queryClient, trpcClient, initialMeta, dehydratedState }: AppProps) {
  const [meta, setMeta] = useState<StoreMeta>(initialMeta ?? DEFAULT_META)

  useEffect(() => {
    fetchMeta().then((m) => {
      setMeta(m)
      applyMeta(m)
    })
  }, [])

  return (
    <MetaContext.Provider value={meta}>
      <I18nProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <HydrationBoundary state={dehydratedState}>
              <AuthProvider>
                <CurrencyProvider>
                  <WishlistProvider>
                    <CartProvider>
                      <div className="min-h-screen bg-gray-50 flex flex-col">
                        <Header />
                        <InstallPrompt />
                        <main className="flex-1">
                          <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/products" element={<ProductsPage />} />
                            <Route path="/products/:slug" element={<ProductPage />} />
                            <Route path="/cart" element={<CartPage />} />
                            <Route path="/checkout" element={<CheckoutPage />} />
                            <Route path="/order/:number" element={<OrderConfirmPage />} />
                            <Route path="/search" element={<SearchPage />} />
                            <Route path="/wishlist" element={<WishlistPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/account" element={<AccountPage />} />
                            <Route path="/account/addresses" element={<AddressBookPage />} />
                            <Route path="/invoice/:number" element={<InvoicePage />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            <Route path="/unsubscribe" element={<UnsubscribePage />} />
                            <Route path="/category/:slug" element={<CategoryPage />} />
                            <Route path="/categories/:slug" element={<RedirectCategory />} />
                            <Route path="/pages/:slug" element={<CmsPageView />} />
                            <Route
                              path="*"
                              element={<RedirectOrNotFound fallback={<NotFoundPage />} />}
                            />
                          </Routes>
                        </main>
                        <StorefrontFooter />
                      </div>
                    </CartProvider>
                  </WishlistProvider>
                </CurrencyProvider>
              </AuthProvider>
            </HydrationBoundary>
          </QueryClientProvider>
        </trpc.Provider>
      </I18nProvider>
    </MetaContext.Provider>
  )
}

function StorefrontFooter() {
  const meta = useMeta()
  const { locale } = useI18n()
  const { data: pages = [] } = trpc.cms.list.useQuery({ locale })

  return (
    <footer className="border-t border-gray-200 bg-white py-8 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {meta.branding.tagline ?? meta.storeName}
          {meta.branding.contactEmail && (
            <>
              {' '}
              ·{' '}
              <a href={`mailto:${meta.branding.contactEmail}`} className="hover:underline">
                {meta.branding.contactEmail}
              </a>
            </>
          )}
        </p>
        {pages.length > 0 && (
          <nav className="flex gap-4">
            {pages.map((p) => (
              <Link
                key={p.id}
                to={`/pages/${p.slug}`}
                className="text-sm text-gray-500 hover:text-gray-900 hover:underline"
              >
                {p.title}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  )
}
