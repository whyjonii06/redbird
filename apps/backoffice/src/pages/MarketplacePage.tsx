import { useState } from 'react'
import { MODULES } from '../modules/registry.js'
import { trpc } from '../trpc.js'

type ConfigField = {
  key: string
  label: string
  type: 'text' | 'password' | 'email' | 'number'
  placeholder?: string
  required: boolean
}

type PluginEntry = {
  name: string
  label: string
  description: string
  category: string
  plan: 'free' | 'pro'
  comingSoon?: boolean
  icon: string
  configFields: ConfigField[]
}

const MARKETPLACE_PLUGINS: PluginEntry[] = [
  // Payment
  {
    name: '@redbird/plugin-stripe',
    label: 'Stripe',
    description: 'Stripe Elements — cartes, Apple Pay, Google Pay.',
    category: 'Payment',
    plan: 'pro',
    icon: '💳',
    configFields: [
      {
        key: 'secretKey',
        label: 'Secret key',
        type: 'password',
        placeholder: 'sk_live_...',
        required: true,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        type: 'password',
        placeholder: 'whsec_...',
        required: true,
      },
    ],
  },
  {
    name: '@redbird/plugin-paypal',
    label: 'PayPal',
    description: 'PayPal Checkout intégré.',
    category: 'Payment',
    plan: 'pro',
    icon: '🅿️',
    configFields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'AaBb...', required: true },
      {
        key: 'clientSecret',
        label: 'Client secret',
        type: 'password',
        placeholder: '...',
        required: true,
      },
    ],
  },
  {
    name: '@redbird/plugin-klarna',
    label: 'Klarna',
    description: 'Buy now, pay later avec Klarna.',
    category: 'Payment',
    plan: 'pro',
    icon: '🛒',
    comingSoon: true,
    configFields: [],
  },
  // Shipping
  {
    name: '@redbird/plugin-shipping-flat',
    label: 'Flat Rate Shipping',
    description: 'Tarif fixe par zone, seuil de gratuité.',
    category: 'Shipping',
    plan: 'pro',
    icon: '📦',
    configFields: [],
  },
  {
    name: '@redbird/plugin-shipping-zones',
    label: 'Shipping Zones',
    description: 'Tranches de poids par zone pays.',
    category: 'Shipping',
    plan: 'pro',
    icon: '🌍',
    configFields: [],
  },
  {
    name: '@redbird/plugin-shipping-mondial-relay',
    label: 'Mondial Relay',
    description: 'Livraison en point relais (France/Benelux) — recherche de points relais au checkout.',
    category: 'Shipping',
    plan: 'free',
    icon: '🏪',
    configFields: [
      {
        key: 'enseigne',
        label: 'Enseigne (code 8 caractères)',
        type: 'text',
        placeholder: 'BDTEST13',
        required: true,
      },
      {
        key: 'privateKey',
        label: 'Clé privée',
        type: 'password',
        placeholder: 'PrivateK',
        required: true,
      },
      {
        key: 'rateAmount',
        label: 'Tarif point relais (centimes)',
        type: 'number',
        placeholder: '490',
        required: false,
      },
    ],
  },
  {
    name: '@redbird/plugin-colissimo',
    label: 'Colissimo',
    description: 'Expédition La Poste — étiquettes et suivi.',
    category: 'Shipping',
    plan: 'pro',
    icon: '📮',
    comingSoon: true,
    configFields: [],
  },
  // Tax
  {
    name: '@redbird/plugin-tax-rules',
    label: 'Tax Rules',
    description: 'Classes de taxe nommées, taux par pays.',
    category: 'Tax',
    plan: 'pro',
    icon: '🧾',
    configFields: [],
  },
  {
    name: '@redbird/plugin-vat-eu',
    label: 'EU VAT',
    description: 'TVA UE (27 pays), VIES, reverse charge.',
    category: 'Tax',
    plan: 'pro',
    icon: '🇪🇺',
    configFields: [
      {
        key: 'homeCountry',
        label: 'Home country',
        type: 'text',
        placeholder: 'FR',
        required: true,
      },
    ],
  },
  // Email
  {
    name: '@redbird/plugin-email-resend',
    label: 'Resend',
    description: 'Emails transactionnels via Resend.',
    category: 'Email',
    plan: 'pro',
    icon: '✉️',
    configFields: [
      { key: 'apiKey', label: 'API key', type: 'password', placeholder: 're_...', required: true },
      {
        key: 'from',
        label: 'From address',
        type: 'email',
        placeholder: 'shop@mystore.com',
        required: true,
      },
    ],
  },
  {
    name: '@redbird/plugin-email-smtp',
    label: 'SMTP',
    description: "Emails via n'importe quel serveur SMTP.",
    category: 'Email',
    plan: 'pro',
    icon: '📧',
    configFields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'smtp.example.com', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587', required: true },
      { key: 'user', label: 'Username', type: 'text', placeholder: '...', required: true },
      { key: 'password', label: 'Password', type: 'password', placeholder: '...', required: true },
      {
        key: 'from',
        label: 'From address',
        type: 'email',
        placeholder: 'shop@mystore.com',
        required: true,
      },
    ],
  },
  {
    name: '@redbird/plugin-email-local',
    label: 'Email Local (dev)',
    description: 'Stocke les emails en mémoire — dev uniquement.',
    category: 'Email',
    plan: 'free',
    icon: '🗃️',
    configFields: [],
  },
  // Store
  {
    name: '@redbird/plugin-analytics',
    label: 'Analytics',
    description: 'Événements analytics boutique.',
    category: 'Store',
    plan: 'pro',
    icon: '📊',
    configFields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'console', required: true },
      { key: 'siteId', label: 'Site ID', type: 'text', placeholder: '...', required: false },
    ],
  },
]

const CATEGORY_ORDER = ['Payment', 'Shipping', 'Tax', 'Email', 'Store']

export function MarketplacePage() {
  const { data: license, isLoading } = trpc.admin.license.status.useQuery()
  const { data: activePlugins = [], refetch: refetchPlugins } = trpc.admin.plugins.list.useQuery()
  const activeNames = new Set(activePlugins.map((p) => p.name))
  const isPro = license?.valid && license.plan === 'pro'

  const [openForm, setOpenForm] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const installMut = trpc.admin.plugins.install.useMutation({
    onSuccess: () => {
      void refetchPlugins()
      setOpenForm(null)
      setFormValues({})
      setFormError(null)
    },
    onError: (e) => setFormError(e.message),
  })

  const uninstallMut = trpc.admin.plugins.uninstall.useMutation({
    onSuccess: () => void refetchPlugins(),
  })

  function openConfig(plugin: PluginEntry) {
    setOpenForm(plugin.name)
    setFormValues({})
    setFormError(null)
  }

  function handleInstall(plugin: PluginEntry) {
    const missing = plugin.configFields.filter((f) => f.required && !formValues[f.key]?.trim())
    if (missing.length > 0) {
      setFormError(`Required: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    const config = plugin.configFields.length > 0 ? formValues : undefined
    installMut.mutate({ name: plugin.name, ...(config !== undefined ? { config } : {}) })
  }

  const categories = CATEGORY_ORDER.map((cat) => ({
    name: cat,
    plugins: MARKETPLACE_PLUGINS.filter((p) => p.category === cat),
  }))

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--bo-text)' }}>
            Marketplace
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
            Official Redbird plugins
          </p>
        </div>
        {!isLoading && (
          <div className="text-right">
            {isPro ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}
              >
                <span className="text-xs font-bold" style={{ color: '#22c55e' }}>
                  PRO
                </span>
                <span className="text-xs" style={{ color: 'var(--bo-muted)' }}>
                  {license.email}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--bo-muted)' }}>
                    FREE
                  </span>
                </div>
                <a
                  href="https://marketplace.redbird.dev/subscribe"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--bo-accent)', color: '#fff' }}
                >
                  Upgrade to Pro →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {license?.message && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'rgba(232,48,42,0.06)',
            border: '1px solid rgba(232,48,42,0.2)',
            color: 'var(--bo-muted)',
          }}
        >
          ⚠ {license.message}
        </div>
      )}

      {/* Sellable storefront themes */}
      <StorefrontThemesSection />

      {/* Bundled modules (free, toggleable) */}
      <ModulesSection />

      {/* Plugin catalog */}
      <div className="space-y-10">
        {categories.map(({ name, plugins }) => (
          <section key={name} id={`category-${name}`}>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--bo-muted)' }}
            >
              {name}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plugins.map((plugin) => {
                const isActive = activeNames.has(plugin.name)
                const isLocked = plugin.plan === 'pro' && !isPro
                const isOpen = openForm === plugin.name
                const isInstalling =
                  installMut.isPending && installMut.variables?.name === plugin.name
                const hasConfig = plugin.configFields.length > 0

                return (
                  <div
                    key={plugin.name}
                    className="relative rounded-xl flex flex-col"
                    style={{
                      background: 'var(--bo-bg2)',
                      border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : isOpen ? 'rgba(232,48,42,0.3)' : 'var(--bo-border)'}`,
                      opacity: plugin.comingSoon ? 0.6 : 1,
                    }}
                  >
                    <div className="p-4 flex flex-col gap-2">
                      {/* Badges */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        {plugin.comingSoon && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                          >
                            Soon
                          </span>
                        )}
                        {plugin.plan === 'pro' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{
                              background: isPro ? 'rgba(34,197,94,0.1)' : 'rgba(232,48,42,0.1)',
                              color: isPro ? '#22c55e' : 'var(--bo-accent)',
                            }}
                          >
                            PRO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pr-16">
                        <span className="text-xl">{plugin.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
                          {plugin.label}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed" style={{ color: 'var(--bo-muted)' }}>
                        {plugin.description}
                      </p>

                      <p
                        className="text-xs font-mono"
                        style={{ color: 'var(--bo-muted)', opacity: 0.5 }}
                      >
                        {plugin.name}
                      </p>

                      {/* Status + action */}
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        {isActive ? (
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                          >
                            Active
                          </span>
                        ) : (
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                          >
                            {plugin.comingSoon ? 'Coming soon' : 'Not installed'}
                          </span>
                        )}

                        {!plugin.comingSoon && isLocked && (
                          <a
                            href="https://marketplace.redbird.dev/subscribe"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={{
                              background: 'var(--bo-accent)',
                              color: '#fff',
                              textDecoration: 'none',
                            }}
                          >
                            Unlock
                          </a>
                        )}

                        {!plugin.comingSoon && !isLocked && !isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasConfig) {
                                openConfig(plugin)
                                return
                              }
                              handleInstall(plugin)
                            }}
                            disabled={isInstalling}
                            className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                            style={{
                              background: isOpen ? 'transparent' : 'var(--bo-accent)',
                              border: `1px solid ${isOpen ? 'var(--bo-border)' : 'var(--bo-accent)'}`,
                              color: isOpen ? 'var(--bo-muted)' : '#fff',
                              cursor: isInstalling ? 'not-allowed' : 'pointer',
                              opacity: isInstalling ? 0.7 : 1,
                            }}
                          >
                            {isInstalling ? 'Installing…' : isOpen ? 'Cancel' : 'Install'}
                          </button>
                        )}

                        {isActive && (
                          <button
                            type="button"
                            onClick={() => uninstallMut.mutate({ name: plugin.name })}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--bo-border)',
                              color: 'var(--bo-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            Uninstall
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Config form panel */}
                    {isOpen && hasConfig && (
                      <div
                        style={{
                          borderTop: '1px solid var(--bo-border)',
                          padding: '12px 16px 16px',
                        }}
                      >
                        <p
                          className="text-xs font-medium mb-3"
                          style={{ color: 'var(--bo-muted)' }}
                        >
                          Plugin configuration
                        </p>
                        <div className="flex flex-col gap-2.5">
                          {plugin.configFields.map((field) => (
                            <div key={field.key}>
                              <label
                                className="block text-xs font-medium mb-1"
                                style={{ color: 'var(--bo-muted)' }}
                              >
                                {field.label}
                                {field.required && (
                                  <span style={{ color: 'var(--bo-accent)' }}> *</span>
                                )}
                              </label>
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                value={formValues[field.key] ?? ''}
                                onChange={(e) => {
                                  setFormError(null)
                                  setFormValues((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }}
                                className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                                style={{
                                  background: 'var(--bo-bg3)',
                                  border: '1px solid var(--bo-border)',
                                  color: 'var(--bo-text)',
                                }}
                              />
                            </div>
                          ))}
                          {formError && isOpen && (
                            <p className="text-xs" style={{ color: 'var(--bo-accent)' }}>
                              {formError}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleInstall(plugin)}
                            disabled={isInstalling}
                            className="w-full text-xs font-semibold py-2 rounded-lg mt-1"
                            style={{
                              background: 'var(--bo-accent)',
                              color: '#fff',
                              cursor: isInstalling ? 'not-allowed' : 'pointer',
                              opacity: isInstalling ? 0.7 : 1,
                              border: 'none',
                            }}
                          >
                            {isInstalling ? 'Installing…' : 'Activate plugin'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {!isPro && (
        <div
          className="mt-12 p-6 rounded-xl text-center"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <p className="text-base font-bold mb-1" style={{ color: 'var(--bo-text)' }}>
            Unlock all plugins with Redbird Pro
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--bo-muted)' }}>
            One subscription. All official plugins. Priority support.
          </p>
          <a
            href="https://marketplace.redbird.dev/subscribe"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'var(--bo-accent)', color: '#fff', textDecoration: 'none' }}
          >
            Subscribe — Redbird Pro →
          </a>
        </div>
      )}
    </div>
  )
}

// ── Bundled modules section ────────────────────────────────────────────────────
const MODULE_CATEGORY_ORDER = ['Sales', 'Catalog', 'Customers', 'Marketing', 'Developer'] as const

function ModulesSection() {
  const utils = trpc.useUtils()
  const { data: states = {} } = trpc.admin.modules.list.useQuery()

  const refetch = () => void utils.admin.modules.list.invalidate()
  const setState = trpc.admin.modules.setState.useMutation({ onSuccess: refetch })
  const uninstall = trpc.admin.modules.uninstall.useMutation({ onSuccess: refetch })

  const grouped = MODULE_CATEGORY_ORDER.map((cat) => ({
    name: cat,
    modules: MODULES.filter((m) => m.category === cat),
  })).filter((g) => g.modules.length > 0)

  return (
    <section className="space-y-4">
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Modules
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
          Free, bundled features. Install the ones you need — your sidebar stays clean.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.flatMap((g) =>
          g.modules.map((mod) => {
            const state = states[mod.name]
            const installed = state === 'active' || state === 'disabled'
            const active = state === 'active'
            const busy = setState.isPending || uninstall.isPending

            return (
              <div
                key={mod.name}
                className="rounded-xl p-4 flex flex-col"
                style={{
                  background: 'var(--bo-bg2)',
                  border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'var(--bo-border)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{mod.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
                    {mod.label}
                  </span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                  >
                    FREE
                  </span>
                </div>
                <p
                  className="text-xs leading-relaxed mt-2 flex-1"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  {mod.description}
                </p>

                <div className="mt-3 pt-2 flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: active ? 'rgba(34,197,94,0.12)' : 'var(--bo-bg3)',
                      color: active ? '#22c55e' : 'var(--bo-muted)',
                    }}
                  >
                    {active ? 'Active' : state === 'disabled' ? 'Disabled' : 'Not installed'}
                  </span>

                  <div className="flex items-center gap-2">
                    {!installed && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setState.mutate({ name: mod.name, state: 'active' })}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--bo-accent)', color: '#fff' }}
                      >
                        Install
                      </button>
                    )}
                    {installed && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setState.mutate({
                              name: mod.name,
                              state: active ? 'disabled' : 'active',
                            })
                          }
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{
                            background: 'var(--bo-bg3)',
                            color: 'var(--bo-text)',
                            border: '1px solid var(--bo-border)',
                          }}
                        >
                          {active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => uninstall.mutate({ name: mod.name })}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          Uninstall
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          }),
        )}
      </div>
    </section>
  )
}

// ── Sellable storefront themes section ─────────────────────────────────────────
function StorefrontThemesSection() {
  const utils = trpc.useUtils()
  const { data } = trpc.admin.storefrontThemes.list.useQuery()
  const refetch = () => void utils.admin.storefrontThemes.list.invalidate()
  const purchase = trpc.admin.storefrontThemes.purchase.useMutation({ onSuccess: refetch })
  const setActive = trpc.admin.storefrontThemes.setActive.useMutation({ onSuccess: refetch })

  const themes = data?.themes ?? []
  const active = data?.active

  return (
    <section className="space-y-4">
      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Storefront themes
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
          Full Next.js storefronts — download to deploy yourself, or set one as your active
          storefront.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const isActive = active === t.id
          const busy = purchase.isPending || setActive.isPending
          return (
            <div
              key={t.id}
              className="rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'var(--bo-bg2)',
                border: `1px solid ${isActive ? 'rgba(34,197,94,0.4)' : 'var(--bo-border)'}`,
              }}
            >
              {/* Preview band */}
              <div
                className="h-24 flex items-center justify-center"
                style={{ background: t.accent }}
              >
                <span className="text-white font-bold text-lg tracking-tight">{t.name}</span>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
                    {t.name}
                  </span>
                  {isActive && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                    >
                      Active
                    </span>
                  )}
                  <span
                    className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--bo-bg3)',
                      color: t.plan === 'free' ? '#22c55e' : 'var(--bo-accent)',
                    }}
                  >
                    {t.plan === 'free' ? 'FREE' : `€${t.priceEur}`}
                  </span>
                </div>
                <p
                  className="text-xs leading-relaxed mt-2 flex-1"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  {t.description}
                </p>

                <div className="mt-3 pt-2 flex items-center gap-2">
                  {!t.owned ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => purchase.mutate({ id: t.id })}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--bo-accent)', color: '#fff' }}
                    >
                      Buy €{t.priceEur}
                    </button>
                  ) : (
                    <>
                      <a
                        href={`/themes/${t.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                        style={{ background: 'var(--bo-accent)', color: '#fff' }}
                      >
                        Download
                      </a>
                      {isActive ? (
                        <span
                          className="text-xs font-medium px-3 py-1.5"
                          style={{ color: 'var(--bo-muted)' }}
                        >
                          In use
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setActive.mutate({ id: t.id })}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{
                            background: 'var(--bo-bg3)',
                            color: 'var(--bo-text)',
                            border: '1px solid var(--bo-border)',
                          }}
                        >
                          Set as active
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
