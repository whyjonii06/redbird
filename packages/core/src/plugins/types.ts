import type { DbClient } from '../db/client.js'
import type { HookHandlers } from './hooks.js'

/**
 * Context passed to a plugin's setup() function once at boot.
 */
export type PluginSetupContext = {
  readonly db: DbClient
}

/**
 * A plugin definition. Author with `definePlugin({ ... })` for full type inference.
 *
 * A "plugin" is a discrete backend extension (a payment provider, an email
 * sender…) — it reacts to hooks but ships no UI of its own. For a full
 * feature with admin pages, a sidebar entry, storefront widgets and its own
 * tables, author a *module* with {@link defineModule} instead.
 */
export type PluginDefinition = {
  readonly name: string
  readonly version?: string
  readonly hooks?: HookHandlers
  readonly setup?: (ctx: PluginSetupContext) => Promise<void> | void
}

/**
 * Define a Redbird plugin with full type inference on hooks.
 *
 * @example
 * export default definePlugin({
 *   name: 'my-plugin',
 *   hooks: {
 *     'order.created': async ({ order }) => {
 *       console.log('Order created:', order.number)
 *     },
 *   },
 * })
 */
export function definePlugin(plugin: PluginDefinition): PluginDefinition {
  return plugin
}

// ── Modules ────────────────────────────────────────────────────────────────
// A module is a full, PrestaShop-style feature: backend hooks + its own tables
// (migrations) + a backoffice sidebar entry & pages + storefront widgets.
//
// The core only carries the *declarative* parts of a module (hooks, migrations,
// lifecycle, and a serializable manifest describing where its UI plugs in).
// The actual React pages/widgets live in the backoffice and storefront, keyed
// by module name in their respective registries — this keeps the core free of
// any React or tRPC dependency while still owning the contract.

/** A SQL migration owned by a module. Applied on install, tracked by tag. */
export type ModuleMigration = {
  /** Unique, stable identifier — used to dedupe already-applied migrations. */
  readonly tag: string
  /** Raw SQL. Additive-only by convention (CREATE TABLE IF NOT EXISTS…). */
  readonly sql: string
}

/** A sidebar entry contributed by a module. */
export type ModuleMenuEntry = {
  readonly label: string
  /** Route path mounted in the backoffice, e.g. "/reviews". */
  readonly path: string
  /** Emoji or icon key rendered before the label. */
  readonly icon?: string
  /** Sidebar group heading; falls back to an "Extensions" group when omitted. */
  readonly group?: string
  /** Ordering within the group (lower = higher). Defaults to 100. */
  readonly position?: number
}

/**
 * Serializable description of where a module's UI plugs in. Sent to the
 * backoffice/storefront so they can render menu entries and mount widgets
 * without the core depending on React.
 */
export type ModuleManifest = {
  /** Sidebar entries (one module may add several). */
  readonly menu?: ReadonlyArray<ModuleMenuEntry>
  /** Storefront slot names this module fills (e.g. "product.tab", "footer"). */
  readonly slots?: ReadonlyArray<string>
}

/**
 * A module definition — a superset of {@link PluginDefinition} that adds owned
 * migrations, install/uninstall lifecycle, and a UI manifest.
 */
export type ModuleDefinition = PluginDefinition & {
  /** SQL tables owned by this module, created on install. */
  readonly migrations?: ReadonlyArray<ModuleMigration>
  /** Run once when the module is first installed (after migrations). */
  readonly install?: (ctx: PluginSetupContext) => Promise<void> | void
  /** Run when the module is uninstalled (drop tables, cleanup). */
  readonly uninstall?: (ctx: PluginSetupContext) => Promise<void> | void
  /** Declarative description of the module's UI surfaces. */
  readonly manifest?: ModuleManifest
}

/**
 * Define a Redbird module with full type inference.
 *
 * @example
 * export default defineModule({
 *   name: '@redbird/module-reviews',
 *   hooks: { 'review.approved': async ({ review }) => recomputeRating(review.productId) },
 *   migrations: [{ tag: 'reviews_init', sql: 'CREATE TABLE IF NOT EXISTS …' }],
 *   manifest: {
 *     menu: [{ label: 'Reviews', icon: '⭐', path: '/reviews', group: 'Store', position: 50 }],
 *     slots: ['product.tab'],
 *   },
 * })
 */
export function defineModule(module: ModuleDefinition): ModuleDefinition {
  return module
}
