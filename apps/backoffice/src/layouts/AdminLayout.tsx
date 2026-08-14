import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { clearSession, getAdminKey, getStaffRole, getStaffToken } from '../auth.js'
import { useEventSource } from '../hooks/useEventSource.js'
import { LOCALES, useI18n } from '../i18n/index.js'
import { type ModuleStates, activeModuleMenu } from '../modules/registry.js'
import { trpc } from '../trpc.js'

type NavItem = { to: string; label: string; icon?: string; position?: number }
type NavGroup = { label: string | null; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/marketplace', label: 'Marketplace' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products', label: 'Products' },
      { to: '/categories', label: 'Categories' },
      { to: '/warehouses', label: 'Warehouses' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', label: 'Orders' },
      { to: '/returns', label: 'Returns' },
      { to: '/reports', label: 'Reports' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/customers', label: 'Customers' },
      { to: '/customer-groups', label: 'Groups' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/promos', label: 'Promos' },
      { to: '/campaigns', label: 'Campaigns' },
      { to: '/subscriptions', label: 'Subscriptions' },
      { to: '/cms', label: 'CMS Pages' },
      { to: '/navigation', label: 'Navigation' },
      { to: '/redirects', label: 'Redirects' },
      { to: '/theme-editor', label: 'Theme Editor' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/staff', label: 'Staff' },
      { to: '/audit-log', label: 'Audit log' },
      { to: '/modules', label: 'Modules' },
      { to: '/feature-flags', label: 'Feature flags' },
      { to: '/mailbox', label: 'Mailbox' },
      { to: '/settings', label: 'Settings' },
    ],
  },
]

/**
 * Merge module-contributed menu entries into the static core groups.
 * Entries are inserted into their declared group (a new group is appended
 * when unknown) and sorted by `position` after the core items.
 */
function buildNavGroups(states: ModuleStates): NavGroup[] {
  const groups: NavGroup[] = navGroups.map((g) => ({ ...g, items: [...g.items] }))

  for (const entry of activeModuleMenu(states)) {
    const item: NavItem = {
      to: entry.path,
      label: entry.label,
      ...(entry.icon ? { icon: entry.icon } : {}),
      position: entry.position ?? 100,
    }
    const groupName = entry.group ?? 'Extensions'
    let group = groups.find((g) => g.label === groupName)
    if (!group) {
      group = { label: groupName, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }

  // Sort items that carry an explicit position; untouched groups keep order.
  for (const group of groups) {
    if (group.items.some((i) => i.position !== undefined)) {
      group.items.sort((a, b) => (a.position ?? 100) - (b.position ?? 100))
    }
  }
  return groups
}

const DEFAULT_EXPANDED: Record<string, boolean> = {
  Catalog: true,
  Sales: true,
  Customers: true,
  Marketing: false,
  System: false,
}

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem('rb_nav_expanded')
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : DEFAULT_EXPANDED
  } catch {
    return DEFAULT_EXPANDED
  }
}

export function AdminLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, locale, setLocale } = useI18n()
  const navLabel = (label: string) => {
    const v = t(`nav.${label}`)
    return v === `nav.${label}` ? label : v
  }
  const groupLabel = (label: string) => {
    const v = t(`nav.group.${label}`)
    return v === `nav.group.${label}` ? label : v
  }
  const adminKey = getAdminKey()
  const staffToken = getStaffToken()
  const staffRole = getStaffRole()
  const isAuthenticated = Boolean(adminKey || staffToken)
  const { data: moduleStates = {} } = trpc.admin.modules.list.useQuery(undefined, {
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded)
  const [orderNotif, setOrderNotif] = useState<{
    number: number
    total: number
    currency: string
  } | null>(null)
  const [newOrderCount, setNewOrderCount] = useState(0)

  useEventSource(
    '/events',
    useCallback((data) => {
      const ev = data as { type: string; orderNumber?: number; total?: number; currency?: string }
      if (ev.type === 'order.created') {
        setNewOrderCount((n) => n + 1)
        if (ev.orderNumber) {
          setOrderNotif({
            number: ev.orderNumber,
            total: ev.total ?? 0,
            currency: ev.currency ?? 'EUR',
          })
          setTimeout(() => setOrderNotif(null), 6000)
        }
      }
    }, []),
  )

  if (!isAuthenticated) return <Navigate to="/login" replace />

  function logout() {
    clearSession()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try {
        localStorage.setItem('rb_nav_expanded', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  return (
    <>
      <div className="flex h-screen" style={{ background: 'var(--bo-bg)' }}>
        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 flex flex-col"
          style={{ background: 'var(--bo-bg2)', borderRight: '1px solid var(--bo-border)' }}
        >
          {/* Logo */}
          <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--bo-border)' }}>
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/redbird.svg"
                alt=""
                className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <span
                className="text-base font-bold tracking-tight group-hover:text-[#E8302A] transition-colors"
                style={{ letterSpacing: '-0.02em', color: 'var(--bo-text)' }}
              >
                redbird
              </span>
            </Link>
            <p
              className="text-xs mt-2"
              style={{
                color: 'var(--bo-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {staffRole
                ? `${staffRole.charAt(0).toUpperCase()}${staffRole.slice(1)}`
                : t('nav.masterAdmin')}
            </p>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto" style={{ padding: '8px 0' }}>
            {buildNavGroups(moduleStates).map((group, gi) => (
              <div key={group.label ?? '__root'}>
                {/* Group header */}
                {group.label !== null && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label!)}
                    className="w-full flex items-center justify-between transition-colors"
                    style={{
                      marginTop: gi === 0 ? 0 : 4,
                      padding: '7px 16px 7px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderTop: '1px solid var(--bo-border)',
                      borderRight: 'none',
                      borderBottom: expanded[group.label]
                        ? '1px solid var(--bo-border)'
                        : '1px solid transparent',
                      borderLeft: 'none',
                      borderRadius: 0,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: 'var(--bo-text)',
                        opacity: 0.5,
                      }}
                    >
                      {groupLabel(group.label)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                        transform: expanded[group.label] ? 'rotate(0deg)' : 'rotate(-90deg)',
                        color: 'var(--bo-muted)',
                      }}
                    >
                      ▾
                    </span>
                  </button>
                )}

                {/* Group items */}
                {(group.label === null || expanded[group.label]) && (
                  <div
                    style={{
                      padding: group.label ? '4px 8px' : '0 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {group.items.map(({ to, label, icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        onClick={() => {
                          if (label === 'Orders') setNewOrderCount(0)
                        }}
                        className="flex items-center text-xs font-medium transition-colors rounded-md"
                        style={({ isActive }) =>
                          isActive
                            ? {
                                color: 'var(--bo-text)',
                                borderLeft: '2px solid var(--bo-accent)',
                                padding: '7px 12px 7px 10px',
                                background: 'rgba(232,48,42,0.08)',
                              }
                            : {
                                color: 'var(--bo-muted)',
                                borderLeft: '2px solid transparent',
                                padding: '7px 12px 7px 10px',
                              }
                        }
                      >
                        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
                        {navLabel(label)}
                        {label === 'Orders' && newOrderCount > 0 && (
                          <span
                            className="ml-auto font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--bo-accent)',
                              color: '#fff',
                              fontSize: '10px',
                            }}
                          >
                            {newOrderCount}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-2 py-3" style={{ borderTop: '1px solid var(--bo-border)' }}>
            <div className="px-2 pb-2">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number]['code'])}
                aria-label={t('settings.language')}
                className="w-full text-xs rounded-md px-2 py-1.5 outline-none"
                style={{
                  background: 'var(--bo-bg3)',
                  border: '1px solid var(--bo-border)',
                  color: 'var(--bo-muted)',
                }}
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
            <a
              href={import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-2 text-xs font-medium rounded-md transition-colors"
              style={{ color: 'var(--bo-muted)', paddingLeft: '12px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bo-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bo-muted)')}
            >
              {t('nav.viewStore')}
            </a>
            <button
              type="button"
              onClick={logout}
              className="w-full text-left flex items-center px-3 py-2 text-xs font-medium rounded-md transition-colors"
              style={{ color: 'var(--bo-muted)', paddingLeft: '12px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bo-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bo-muted)')}
            >
              {t('nav.logout')}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bo-bg)' }}>
          <Outlet />
        </main>
      </div>

      {/* Order notification toast */}
      {orderNotif && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-3"
          style={{ background: '#22c55e', color: '#fff', zIndex: 9999 }}
        >
          <span>🛍</span>
          <span>
            {t('nav.newOrder', {
              number: orderNotif.number,
              total: (orderNotif.total / 100).toLocaleString(locale, {
                style: 'currency',
                currency: orderNotif.currency,
              }),
            })}
          </span>
        </div>
      )}
    </>
  )
}
