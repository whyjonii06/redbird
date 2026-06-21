import { useState } from 'react'
import { trpc } from '../trpc.js'

const KNOWN_PLUGINS: Record<string, { label: string; description: string; category: string }> = {
  '@redbird/plugin-shipping-flat': {
    label: 'Flat Rate Shipping',
    description: 'Fixed shipping rate with optional free threshold per zone.',
    category: 'Shipping',
  },
  '@redbird/plugin-shipping-zones': {
    label: 'Shipping Zones',
    description: 'Weight-based shipping tiers per country zone.',
    category: 'Shipping',
  },
  '@redbird/plugin-tax-rules': {
    label: 'Tax Rules',
    description: 'Named tax classes with per-country rates and exemptions.',
    category: 'Tax',
  },
  '@redbird/plugin-vat-eu': {
    label: 'EU VAT',
    description: 'EU VAT (27 countries), VIES validation, B2B reverse charge.',
    category: 'Tax',
  },
  '@redbird/plugin-stripe': {
    label: 'Stripe',
    description: 'Stripe Elements payment integration at checkout.',
    category: 'Payment',
  },
  '@redbird/plugin-paypal': {
    label: 'PayPal',
    description: 'PayPal payment integration.',
    category: 'Payment',
  },
  '@redbird/plugin-email-resend': {
    label: 'Email via Resend',
    description: 'Transactional emails using the Resend API.',
    category: 'Email',
  },
  '@redbird/plugin-email-smtp': {
    label: 'Email via SMTP',
    description: 'Transactional emails using any SMTP server.',
    category: 'Email',
  },
  '@redbird/plugin-reviews': {
    label: 'Product Reviews',
    description: 'Customer reviews with moderation hooks.',
    category: 'Store',
  },
  '@redbird/plugin-analytics': {
    label: 'Analytics',
    description: 'Store analytics events.',
    category: 'Store',
  },
  '@redbird/plugin-email-local': {
    label: 'Email Local (dev)',
    description: 'Stores emails in memory — no SMTP needed. View them in the Mailbox page.',
    category: 'Email',
  },
}

const CATEGORY_ORDER = ['Payment', 'Shipping', 'Tax', 'Email', 'Store']

const PLUGIN_CONFIG_FIELDS: Record<
  string,
  Array<{ key: string; label: string; type?: 'password' | 'text' | 'number' }>
> = {
  '@redbird/plugin-stripe': [
    { key: 'publicKey', label: 'Public Key (pk_...)' },
    { key: 'secretKey', label: 'Secret Key (sk_...)', type: 'password' },
  ],
  '@redbird/plugin-paypal': [
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password' },
  ],
  '@redbird/plugin-email-resend': [
    { key: 'apiKey', label: 'Resend API Key (re_...)', type: 'password' },
    { key: 'from', label: 'From email (noreply@...)' },
  ],
  '@redbird/plugin-email-smtp': [
    { key: 'host', label: 'SMTP Host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'user', label: 'Username' },
    { key: 'pass', label: 'Password', type: 'password' },
    { key: 'from', label: 'From email' },
  ],
}

export function ModulesPage() {
  const { data: active = [], isLoading } = trpc.admin.plugins.list.useQuery()
  const { data: installed = [] } = trpc.admin.plugins.listInstalled.useQuery()
  const { data: savedConfig = {} } = trpc.admin.plugins.getConfig.useQuery()
  const saveConfigMut = trpc.admin.plugins.saveConfig.useMutation()
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})

  const activeNames = new Set(active.map((p) => p.name))
  const installedNames = new Set(installed.map((p) => p.name))
  // A plugin appears in the list only if it's active (running) or installed (in meta.json)
  const visibleNames = new Set([...activeNames, ...installedNames])

  const categories = CATEGORY_ORDER.map((cat) => ({
    name: cat,
    plugins: Object.entries(KNOWN_PLUGINS).filter(
      ([key, meta]) => meta.category === cat && visibleNames.has(key),
    ),
  }))

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--bo-text)' }}>
        Modules
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--bo-muted)' }}>
        Plugins registered at server startup.{' '}
        {active.length === 0 && !isLoading && (
          <span style={{ color: 'var(--bo-accent)' }}>
            No plugins active — check your server config.
          </span>
        )}
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: 'var(--bo-bg3)' }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map(({ name, plugins }) => {
            if (plugins.length === 0) return null
            const activeCat = plugins.filter(([key]) => activeNames.has(key))
            const inactiveCat = plugins.filter(([key]) => !activeNames.has(key))
            return (
              <section key={name}>
                <h2
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  {name}
                </h2>
                <div className="space-y-2">
                  {[...activeCat, ...inactiveCat].map(([key, info]) => {
                    const isActive = activeNames.has(key)
                    const isInactive = !isActive && installedNames.has(key)
                    const plugin = active.find((p) => p.name === key)
                    return (
                      <div
                        key={key}
                        className="rounded-xl overflow-hidden"
                        style={{
                          background: 'var(--bo-bg2)',
                          border: `1px solid ${isActive ? 'rgba(232,48,42,0.25)' : 'var(--bo-border)'}`,
                          opacity: isInactive ? 0.6 : 1,
                        }}
                      >
                        <div className="flex items-center gap-4 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-medium"
                                style={{ color: 'var(--bo-text)' }}
                              >
                                {info.label}
                              </span>
                              {plugin?.version && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                                >
                                  v{plugin.version}
                                </span>
                              )}
                            </div>
                            <p
                              className="text-xs mt-0.5 truncate"
                              style={{ color: 'var(--bo-muted)' }}
                            >
                              {info.description}
                            </p>
                            <p
                              className="text-xs mt-0.5 font-mono"
                              style={{ color: 'var(--bo-muted)', opacity: 0.6 }}
                            >
                              {key}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {PLUGIN_CONFIG_FIELDS[key] && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingPlugin === key) {
                                    setEditingPlugin(null)
                                  } else {
                                    setEditingPlugin(key)
                                    setConfigValues(savedConfig[key] ?? {})
                                  }
                                }}
                                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                                style={{
                                  background: 'var(--bo-bg3)',
                                  border: '1px solid var(--bo-border)',
                                  color: 'var(--bo-muted)',
                                }}
                              >
                                {editingPlugin === key ? 'Cancel' : 'Configure'}
                              </button>
                            )}
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={
                                isActive
                                  ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e' }
                                  : { background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }
                              }
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {editingPlugin === key && PLUGIN_CONFIG_FIELDS[key] && (
                          <div
                            className="px-4 pb-4 pt-2 space-y-3"
                            style={{ borderTop: '1px solid var(--bo-border)' }}
                          >
                            {PLUGIN_CONFIG_FIELDS[key]!.map((field) => (
                              <div key={field.key}>
                                <label
                                  className="block text-xs mb-1"
                                  style={{ color: 'var(--bo-muted)' }}
                                >
                                  {field.label}
                                </label>
                                <input
                                  type={
                                    field.type === 'password'
                                      ? 'password'
                                      : field.type === 'number'
                                        ? 'number'
                                        : 'text'
                                  }
                                  value={configValues[field.key] ?? ''}
                                  onChange={(e) =>
                                    setConfigValues((prev) => ({
                                      ...prev,
                                      [field.key]: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                                  style={{
                                    background: 'var(--bo-bg3)',
                                    border: '1px solid var(--bo-border)',
                                    color: 'var(--bo-text)',
                                  }}
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                saveConfigMut.mutate({ pluginName: key, config: configValues })
                                setEditingPlugin(null)
                              }}
                              disabled={saveConfigMut.isPending}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              style={{ background: 'var(--bo-accent)', color: '#fff' }}
                            >
                              {saveConfigMut.isPending ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* Unknown active plugins (not in KNOWN_PLUGINS) */}
          {active.filter((p) => !KNOWN_PLUGINS[p.name]).length > 0 && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--bo-muted)' }}
              >
                Custom
              </h2>
              <div className="space-y-2">
                {active
                  .filter((p) => !KNOWN_PLUGINS[p.name])
                  .map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl"
                      style={{
                        background: 'var(--bo-bg2)',
                        border: '1px solid rgba(232,48,42,0.25)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: 'var(--bo-text)' }}>
                          {p.name}
                        </span>
                        {p.version && (
                          <span
                            className="ml-2 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                          >
                            v{p.version}
                          </span>
                        )}
                      </div>
                      <span
                        className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                      >
                        Active
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div
        className="mt-10 p-4 rounded-xl text-sm"
        style={{
          background: 'var(--bo-bg2)',
          border: '1px solid var(--bo-border)',
          color: 'var(--bo-muted)',
        }}
      >
        <strong style={{ color: 'var(--bo-text)' }}>Adding plugins</strong> — Register plugins in
        your server config:{' '}
        <code
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'var(--bo-bg3)' }}
        >
          createRedbird(&#123; plugins: [pluginStripe(...), pluginTaxRules(...)] &#125;)
        </code>
      </div>

      <div
        className="mt-4 p-4 rounded-xl text-sm"
        style={{
          background: 'rgba(232,48,42,0.06)',
          border: '1px solid rgba(232,48,42,0.2)',
          color: 'var(--bo-muted)',
        }}
      >
        &#x26A0; API keys saved here are stored in{' '}
        <code
          className="text-xs px-1 py-0.5 rounded font-mono"
          style={{ background: 'var(--bo-bg3)' }}
        >
          redbird.meta.json
        </code>
        . Restart your server for changes to take effect.
      </div>
    </div>
  )
}
