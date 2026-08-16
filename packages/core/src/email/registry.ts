import type { EmailMessage, EmailProvider } from './types.js'

export class EmailRegistry {
  private readonly providers = new Map<string, EmailProvider>()
  private _defaultName: string | null = null

  register(provider: EmailProvider): this {
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
        `Email provider "${name}" not registered. Available: ${[...this.providers.keys()].join(', ')}`,
      )
    }
    this._defaultName = name
    return this
  }

  get(name: string): EmailProvider | undefined {
    return this.providers.get(name)
  }

  list(): EmailProvider[] {
    return [...this.providers.values()]
  }

  default(): EmailProvider | null {
    if (!this._defaultName) {
      return this.providers.size === 1 ? ([...this.providers.values()][0] ?? null) : null
    }
    return this.providers.get(this._defaultName) ?? null
  }

  async send(message: EmailMessage): Promise<void> {
    const provider = this.default()
    if (!provider) throw new Error('No email provider registered')
    await provider.send(message)
  }
}
