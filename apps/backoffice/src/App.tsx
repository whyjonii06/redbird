import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { I18nProvider } from './i18n/index.js'
import { AdminLayout } from './layouts/AdminLayout.js'
import { moduleRoutes } from './modules/registry.js'
import { AuditLogPage } from './pages/AuditLogPage.js'
import { CampaignsPage } from './pages/CampaignsPage.js'
import { CategoriesPage } from './pages/CategoriesPage.js'
import { CmsPage } from './pages/CmsPage.js'
import { CustomerDetailPage } from './pages/CustomerDetailPage.js'
import { CustomerGroupsPage } from './pages/CustomerGroupsPage.js'
import { CustomersPage } from './pages/CustomersPage.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { FeatureFlagsPage } from './pages/FeatureFlagsPage.js'
import { LoginPage } from './pages/LoginPage.js'
import { MailboxPage } from './pages/MailboxPage.js'
import { MarketplacePage } from './pages/MarketplacePage.js'
import { ModulesPage } from './pages/ModulesPage.js'
import { NavigationPage } from './pages/NavigationPage.js'
import { OrderDetailPage } from './pages/OrderDetailPage.js'
import { OrdersPage } from './pages/OrdersPage.js'
import { ProductFormPage } from './pages/ProductFormPage.js'
import { ProductsPage } from './pages/ProductsPage.js'
import { PromosPage } from './pages/PromosPage.js'
import { RedirectsPage } from './pages/RedirectsPage.js'
import { ReportsPage } from './pages/ReportsPage.js'
import { ReturnsPage } from './pages/ReturnsPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { SetupPage } from './pages/SetupPage.js'
import { StaffPage } from './pages/StaffPage.js'
import { ThemeEditorPage } from './pages/ThemeEditorPage.js'
import { WarehousesPage } from './pages/WarehousesPage.js'
import { makeTRPCClient, trpc } from './trpc.js'

export default function App() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() => makeTRPCClient())

  return (
    <I18nProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <SetupGuard>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/:id" element={<OrderDetailPage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="products/new" element={<ProductFormPage />} />
                  <Route path="products/:id" element={<ProductFormPage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="customers/:id" element={<CustomerDetailPage />} />
                  <Route path="customer-groups" element={<CustomerGroupsPage />} />
                  <Route path="promos" element={<PromosPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="returns" element={<ReturnsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="staff" element={<StaffPage />} />
                  <Route path="audit-log" element={<AuditLogPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="warehouses" element={<WarehousesPage />} />
                  <Route path="cms" element={<CmsPage />} />
                  <Route path="modules" element={<ModulesPage />} />
                  <Route path="feature-flags" element={<FeatureFlagsPage />} />
                  <Route path="mailbox" element={<MailboxPage />} />
                  <Route path="marketplace" element={<MarketplacePage />} />
                  <Route path="navigation" element={<NavigationPage />} />
                  <Route path="redirects" element={<RedirectsPage />} />
                  <Route path="theme-editor" element={<ThemeEditorPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  {/* Module-contributed routes (lazy-loaded) */}
                  {moduleRoutes().map(({ path, Component }) => (
                    <Route
                      key={path}
                      path={path}
                      element={
                        <Suspense
                          fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}
                        >
                          <Component />
                        </Suspense>
                      }
                    />
                  ))}
                </Route>
              </Routes>
            </SetupGuard>
          </BrowserRouter>
        </QueryClientProvider>
      </trpc.Provider>
    </I18nProvider>
  )
}

/** On mount, check if the server is configured. If not, redirect to /setup. */
function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/setup') return
    fetch('/setup/status')
      .then((r) => r.json())
      .then((data: { configured: boolean }) => {
        if (!data.configured) navigate('/setup', { replace: true })
      })
      .catch(() => {
        // Server unreachable — could be restarting, stay put
      })
  }, [navigate, location.pathname])

  return <>{children}</>
}
