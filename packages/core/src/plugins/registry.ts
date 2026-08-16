import type { DbClient } from '../db/client.js'
import type { HookHandler, HookMap, HookName } from './hooks.js'
import type { ModuleDefinition, ModuleManifest, PluginDefinition } from './types.js'

type EmitInterceptor = (name: string, ctx: unknown) => Promise<void> | void

/**
 * Plugin registry — holds registered plugins and dispatches hooks.
 *
 * Hooks run sequentially in registration order. A handler that throws
 * propagates the error to the emitter; this is intentional for hooks
 * that gate downstream behavior (e.g. cart.beforeAddItem can refuse).
 *
 * Interceptors (added via onEmit) fire for every event before handlers,
 * but their errors are always swallowed so they cannot break the main flow.
 */
export class PluginRegistry {
  private readonly plugins: ModuleDefinition[] = []
  private readonly handlers: Map<HookName, HookHandler<HookName>[]> = new Map()
  private readonly interceptors: EmitInterceptor[] = []

  register(plugin: PluginDefinition | ModuleDefinition): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`)
    }
    this.plugins.push(plugin as ModuleDefinition)
    if (plugin.hooks) {
      for (const [name, handler] of Object.entries(plugin.hooks)) {
        if (!handler) continue
        const hookName = name as HookName
        const existing = this.handlers.get(hookName) ?? []
        existing.push(handler as HookHandler<HookName>)
        this.handlers.set(hookName, existing)
      }
    }
  }

  /** Reverses register() — drops the plugin and its hook handlers. Returns false if not found. */
  remove(name: string): boolean {
    const idx = this.plugins.findIndex((p) => p.name === name)
    if (idx === -1) return false
    const [plugin] = this.plugins.splice(idx, 1)
    if (plugin?.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        if (!handler) continue
        const list = this.handlers.get(hookName as HookName)
        if (!list) continue
        const hIdx = list.indexOf(handler as HookHandler<HookName>)
        if (hIdx !== -1) list.splice(hIdx, 1)
      }
    }
    return true
  }

  async setupAll(db: DbClient): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.setup) {
        await plugin.setup({ db })
      }
    }
  }

  /** Manifests of every registered module that declares UI surfaces. */
  manifests(): ReadonlyArray<{ name: string; manifest: ModuleManifest }> {
    return this.plugins
      .filter((p): p is ModuleDefinition & { manifest: ModuleManifest } => Boolean(p.manifest))
      .map((p) => ({ name: p.name, manifest: p.manifest }))
  }

  /** Register an interceptor that fires for every event. Errors are always swallowed. */
  onEmit(fn: EmitInterceptor): void {
    this.interceptors.push(fn)
  }

  async emit<K extends HookName>(name: K, ctx: HookMap[K]): Promise<void> {
    for (const interceptor of this.interceptors) {
      try {
        await interceptor(name, ctx)
      } catch {
        // interceptor failures must never crash the main flow
      }
    }
    const handlers = this.handlers.get(name)
    if (!handlers) return
    for (const handler of handlers) {
      await (handler as HookHandler<K>)(ctx)
    }
  }

  list(): ReadonlyArray<PluginDefinition> {
    return this.plugins
  }

  has(name: string): boolean {
    return this.plugins.some((p) => p.name === name)
  }
}
