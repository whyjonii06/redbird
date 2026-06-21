import type { ShippingProvider } from './types.js'

export class ShippingRegistry {
  private readonly providers = new Map<string, ShippingProvider>()

  register(provider: ShippingProvider): this {
    this.providers.set(provider.name, provider)
    return this
  }

  default(): ShippingProvider | null {
    return this.providers.size >= 1 ? ([...this.providers.values()][0] ?? null) : null
  }

  get(name: string): ShippingProvider | undefined {
    return this.providers.get(name)
  }

  /** All registered shipping providers. */
  all(): ShippingProvider[] {
    return [...this.providers.values()]
  }

  has(): boolean {
    return this.providers.size > 0
  }
}
