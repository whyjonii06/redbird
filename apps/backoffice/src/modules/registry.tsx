import { type ComponentType, lazy } from 'react'

/**
 * Backoffice module registry — single source of truth for both the sidebar and
 * the marketplace. Each entry marries a module's manifest (menu, description)
 * with its lazily-loaded React pages.
 *
 * These modules are bundled with the build; "installing"/"enabling" them just
 * toggles whether their sidebar entry & page are mounted. Activation state is
 * stored server-side (meta.json `moduleStates`) and read via
 * `trpc.admin.modules.list`.
 *
 * Types are declared locally (not imported from core) on purpose: the
 * backoffice is a browser bundle and must not pull core's Drizzle/PGlite deps.
 */

export type ModuleMenuEntry = {
  label: string
  /** Route path, mounted under the admin layout, e.g. "/reviews". */
  path: string
  icon?: string
  /** Sidebar group heading to inject into; a new group is created if unknown. */
  group?: string
  /** Ordering within the group (lower = higher). Core items sit at 100. */
  position?: number
}

export type BackofficeModule = {
  /** Stable module id; the key used for activation state & config. */
  name: string
  /** Display name in the marketplace. */
  label: string
  /** One-line marketplace description. */
  description: string
  /** Marketplace category grouping. */
  category: 'Sales' | 'Catalog' | 'Customers' | 'Marketing' | 'Developer'
  icon: string
  menu: ModuleMenuEntry[]
  /** Main page component, lazily loaded. */
  Page: ComponentType
  /** Optional dedicated configuration page, mounted at `configPath`. */
  Config?: ComponentType
  configPath?: string
}

const lazyPage = (importer: () => Promise<Record<string, ComponentType>>, named: string) =>
  lazy(() => importer().then((m) => ({ default: m[named]! })))

export const MODULES: BackofficeModule[] = [
  {
    name: '@redbird/plugin-reviews',
    label: 'Product Reviews',
    description: 'Customer reviews with moderation, auto-approve and a storefront widget.',
    category: 'Sales',
    icon: '⭐',
    menu: [{ label: 'Reviews', icon: '⭐', path: '/reviews', group: 'Sales', position: 110 }],
    Page: lazyPage(() => import('../pages/ReviewsPage.js'), 'ReviewsPage'),
    configPath: '/reviews/settings',
    Config: lazyPage(() => import('../pages/ReviewsConfigPage.js'), 'ReviewsConfigPage'),
  },
  {
    name: '@redbird/module-abandoned-carts',
    label: 'Abandoned Carts',
    description: 'Track carts left at checkout to follow up and recover sales.',
    category: 'Sales',
    icon: '🛒',
    menu: [
      {
        label: 'Abandoned Carts',
        icon: '🛒',
        path: '/abandoned-carts',
        group: 'Sales',
        position: 120,
      },
    ],
    Page: lazyPage(() => import('../pages/AbandonedCartsPage.js'), 'AbandonedCartsPage'),
  },
  {
    name: '@redbird/module-brands',
    label: 'Brands',
    description: 'Manage product brands and manufacturers.',
    category: 'Catalog',
    icon: '🏷️',
    menu: [{ label: 'Brands', icon: '🏷️', path: '/brands', group: 'Catalog', position: 110 }],
    Page: lazyPage(() => import('../pages/BrandsPage.js'), 'BrandsPage'),
  },
  {
    name: '@redbird/module-suppliers',
    label: 'Suppliers',
    description: 'Manage suppliers and link them to products for restocking.',
    category: 'Catalog',
    icon: '🏭',
    menu: [{ label: 'Suppliers', icon: '🏭', path: '/suppliers', group: 'Catalog', position: 120 }],
    Page: lazyPage(() => import('../pages/SuppliersPage.js'), 'SuppliersPage'),
  },
  {
    name: '@redbird/module-downloads',
    label: 'Digital Downloads',
    description: 'Attach downloadable files to products for digital delivery.',
    category: 'Catalog',
    icon: '⬇️',
    menu: [{ label: 'Downloads', icon: '⬇️', path: '/downloads', group: 'Catalog', position: 130 }],
    Page: lazyPage(() => import('../pages/DownloadsPage.js'), 'DownloadsPage'),
  },
  {
    name: '@redbird/module-gift-cards',
    label: 'Gift Cards',
    description: 'Issue and redeem store gift cards at checkout.',
    category: 'Customers',
    icon: '🎁',
    menu: [
      { label: 'Gift Cards', icon: '🎁', path: '/gift-cards', group: 'Customers', position: 110 },
    ],
    Page: lazyPage(() => import('../pages/GiftCardsPage.js'), 'GiftCardsPage'),
  },
  {
    name: '@redbird/module-loyalty',
    label: 'Loyalty Program',
    description: 'Reward customers with points they earn and redeem.',
    category: 'Customers',
    icon: '🏅',
    menu: [{ label: 'Loyalty', icon: '🏅', path: '/loyalty', group: 'Customers', position: 120 }],
    Page: lazyPage(() => import('../pages/LoyaltyPage.js'), 'LoyaltyPage'),
  },
  {
    name: '@redbird/module-webhooks',
    label: 'Webhooks',
    description: 'Send real-time event notifications to external URLs.',
    category: 'Developer',
    icon: '🔗',
    menu: [{ label: 'Webhooks', icon: '🔗', path: '/webhooks', group: 'System', position: 110 }],
    Page: lazyPage(() => import('../pages/WebhooksPage.js'), 'WebhooksPage'),
  },
]

export type ModuleState = 'active' | 'disabled'
export type ModuleStates = Record<string, ModuleState>

/** Routes contributed by every module (always mounted; sidebar gates visibility). */
export function moduleRoutes(): { path: string; Component: ComponentType }[] {
  const routes: { path: string; Component: ComponentType }[] = []
  for (const mod of MODULES) {
    for (const entry of mod.menu) {
      routes.push({ path: entry.path.replace(/^\//, ''), Component: mod.Page })
    }
    if (mod.configPath && mod.Config) {
      routes.push({ path: mod.configPath.replace(/^\//, ''), Component: mod.Config })
    }
  }
  return routes
}

/** Menu entries of modules whose state is 'active', for sidebar injection. */
export function activeModuleMenu(states: ModuleStates): (ModuleMenuEntry & { name: string })[] {
  return MODULES.filter((m) => states[m.name] === 'active').flatMap((m) =>
    m.menu.map((entry) => ({ ...entry, name: m.name })),
  )
}
