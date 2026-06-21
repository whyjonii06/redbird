import type { SetupData } from './types.js'

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onNext: () => void
  onBack: () => void
}

type ModuleDef = {
  id: keyof SetupData['modules']
  name: string
  desc: string
  icon: string
  fields?: Array<{ key: string; label: string; placeholder?: string; type?: string }>
}

const PAYMENT_MODULES: ModuleDef[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    desc: 'Card payments, 3D Secure, 135+ currencies',
    icon: '💳',
    fields: [
      { key: 'secretKey', label: 'Secret key', placeholder: 'sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook secret', placeholder: 'whsec_...' },
    ],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    desc: 'PayPal checkout and Pay Later',
    icon: '🅿️',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'AXxx...' },
      { key: 'clientSecret', label: 'Client secret', placeholder: 'EXxx...' },
    ],
  },
]

const EMAIL_MODULES: ModuleDef[] = [
  {
    id: 'resend',
    name: 'Resend',
    desc: 'Transactional emails via the Resend API',
    icon: '✉️',
    fields: [
      { key: 'apiKey', label: 'API key', placeholder: 're_...' },
      { key: 'from', label: 'From address', placeholder: 'shop@example.com' },
    ],
  },
  {
    id: 'smtp',
    name: 'SMTP',
    desc: 'Send via any SMTP server (Postmark, Mailgun, etc.)',
    icon: '📮',
    fields: [
      { key: 'host', label: 'Host', placeholder: 'smtp.example.com' },
      { key: 'port', label: 'Port', placeholder: '587' },
      { key: 'user', label: 'Username', placeholder: 'user@example.com' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'from', label: 'From address', placeholder: 'shop@example.com' },
    ],
  },
]

const EXTRA_MODULES: ModuleDef[] = [
  {
    id: 'flatShipping',
    name: 'Flat-rate shipping',
    desc: 'Fixed shipping costs by zone',
    icon: '🚚',
  },
  {
    id: 'vatEu',
    name: 'EU VAT engine',
    desc: 'EU VAT rates, reverse charge B2B, VIES validation',
    icon: '🇪🇺',
    fields: [{ key: 'homeCountry', label: 'Home country (ISO code)', placeholder: 'FR' }],
  },
  {
    id: 'reviews',
    name: 'Product reviews',
    desc: 'Customer reviews with star ratings',
    icon: '⭐',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    desc: 'Connect Google Analytics or Plausible',
    icon: '📊',
    fields: [
      { key: 'provider', label: 'Provider', placeholder: 'ga4 / plausible / console' },
      { key: 'siteId', label: 'Site ID', placeholder: 'e.g. example.com or G-XXXXXXX' },
    ],
  },
]

export function ModulesStep({ data, onChange, onNext, onBack }: Props) {
  function toggle(id: keyof SetupData['modules']) {
    onChange({
      modules: {
        ...data.modules,
        [id]: { ...data.modules[id], enabled: !data.modules[id].enabled },
      },
    })
  }

  function setField(id: keyof SetupData['modules'], key: string, value: string) {
    onChange({
      modules: {
        ...data.modules,
        [id]: { ...data.modules[id], [key]: value },
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Modules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enable only what you need — you can change this later
        </p>
      </div>

      <Section label="Payments">
        {PAYMENT_MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            def={m}
            mod={data.modules[m.id]}
            onToggle={() => toggle(m.id)}
            onField={(k, v) => setField(m.id, k, v)}
          />
        ))}
      </Section>

      <Section label="Email">
        {EMAIL_MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            def={m}
            mod={data.modules[m.id]}
            onToggle={() => toggle(m.id)}
            onField={(k, v) => setField(m.id, k, v)}
          />
        ))}
      </Section>

      <Section label="Extras">
        {EXTRA_MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            def={m}
            mod={data.modules[m.id]}
            onToggle={() => toggle(m.id)}
            onField={(k, v) => setField(m.id, k, v)}
          />
        ))}
      </Section>

      <div className="flex gap-3 pt-2">
        <BackBtn onClick={onBack} />
        <button
          type="button"
          onClick={onNext}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  )
}

type CardProps = {
  def: ModuleDef
  mod: SetupData['modules'][keyof SetupData['modules']]
  onToggle: () => void
  onField: (key: string, value: string) => void
}

function ModuleCard({ def, mod, onToggle, onField }: CardProps) {
  const enabled = mod.enabled

  return (
    <div
      className="rounded-xl border transition-all overflow-hidden"
      style={
        enabled
          ? { background: 'rgba(232,48,42,0.06)', borderColor: 'rgba(232,48,42,0.3)' }
          : { background: 'var(--bo-bg3)', borderColor: 'var(--bo-border2)' }
      }
    >
      <div
        className="flex items-center gap-4 px-4 py-3.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <span className="text-2xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{def.name}</p>
          <p className="text-xs text-gray-500 truncate">{def.desc}</p>
        </div>
        <Toggle active={enabled} />
      </div>

      {enabled && def.fields && def.fields.length > 0 && (
        <div
          className="px-4 pb-4 space-y-3 pt-3"
          style={{ borderTop: '1px solid rgba(232,48,42,0.2)' }}
        >
          {def.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                value={(mod as unknown as Record<string, string>)[f.key] ?? ''}
                onChange={(e) => onField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Toggle({ active }: { active: boolean }) {
  return (
    <div
      className={`relative w-10 h-6 rounded-full transition-colors ${active ? 'bg-indigo-600' : 'bg-gray-200'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-gray-100 shadow-sm transition-all ${active ? 'left-5' : 'left-1'}`}
      />
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-5 font-semibold py-3 rounded-xl transition-colors"
      style={{ border: '1px solid #2a2a2a', color: 'var(--bo-muted)', background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bo-bg3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      ←
    </button>
  )
}

export { BackBtn }
