import type { TaxProvider } from './types.js'

export class TaxRegistry {
  private readonly providers = new Map<string, TaxProvider>()

  register(provider: TaxProvider): this {
    this.providers.set(provider.name, provider)
    return this
  }

  default(): TaxProvider | null {
    return this.providers.size >= 1 ? ([...this.providers.values()][0] ?? null) : null
  }

  get(name: string): TaxProvider | undefined {
    return this.providers.get(name)
  }

  has(): boolean {
    return this.providers.size > 0
  }
}
