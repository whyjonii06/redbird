import type { PaymentProvider } from './types.js'

export class PaymentRegistry {
  private readonly providers = new Map<string, PaymentProvider>()
  private _defaultName: string | null = null

  register(provider: PaymentProvider): this {
    this.providers.set(provider.name, provider)
    return this
  }

  /** Returns false if the provider wasn't registered. Clears the default if it was that provider. */
  remove(name: string): boolean {
    const removed = this.providers.delete(name)
    if (removed && this._defaultName === name) this._defaultName = null
    return removed
  }

  setDefault(name: string): this {
    if (!this.providers.has(name)) {
      throw new Error(
        `Payment provider "${name}" not registered. Available: ${[...this.providers.keys()].join(', ')}`,
      )
    }
    this._defaultName = name
    return this
  }

  default(): PaymentProvider | null {
    if (!this._defaultName)
      return this.providers.size === 1 ? ([...this.providers.values()][0] ?? null) : null
    return this.providers.get(this._defaultName) ?? null
  }

  get(name: string): PaymentProvider | undefined {
    return this.providers.get(name)
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()]
  }

  get defaultName(): string | null {
    return (
      this._defaultName ??
      (this.providers.size === 1 ? ([...this.providers.keys()][0] ?? null) : null)
    )
  }
}
