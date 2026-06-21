import { BackBtn } from './ModulesStep.js'
import type { SetupData } from './types.js'

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onLaunch: () => void
  onBack: () => void
  error?: string | undefined
  launching?: boolean | undefined
}

export function SummaryStep({ data, onChange, onLaunch, onBack, error, launching }: Props) {
  const enabledModules = (Object.entries(data.modules) as [string, { enabled: boolean }][])
    .filter(([, m]) => m.enabled)
    .map(([id]) => id)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Ready to launch</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review your configuration before we write the files
        </p>
      </div>

      {/* Summary table */}
      <div
        className="rounded-xl overflow-hidden divide-y"
        style={{
          background: 'var(--bo-bg3)',
          borderColor: 'var(--bo-border2)',
          border: '1px solid #2a2a2a',
        }}
      >
        <Row label="Store name" value={data.storeName} />
        <Row label="Currency" value={data.currency} />
        <Row label="Theme" value={capitalize(data.theme)} />
        <Row
          label="Modules"
          value={enabledModules.length > 0 ? enabledModules.join(', ') : 'None'}
        />
        {data.branding.tagline && <Row label="Tagline" value={data.branding.tagline} />}
        {data.branding.logoUrl && <Row label="Logo" value="✓ Set" />}
        <Row label="Admin key" value={'•'.repeat(Math.min(data.adminKey.length, 20))} />
      </div>

      {/* Files that will be written */}
      <div
        className="rounded-xl px-4 py-3 text-sm space-y-1"
        style={{
          background: 'rgba(232,48,42,0.08)',
          border: '1px solid rgba(232,48,42,0.2)',
          color: 'var(--bo-text)',
        }}
      >
        <p className="font-medium">Files that will be created:</p>
        <ul className="list-disc list-inside space-y-0.5" style={{ color: '#aaa' }}>
          <li>
            <code className="font-mono" style={{ color: '#E8302A' }}>
              redbird.config.ts
            </code>{' '}
            — store config + plugins
          </li>
          <li>
            <code className="font-mono" style={{ color: '#E8302A' }}>
              .env
            </code>{' '}
            — secrets and API keys
          </li>
          <li>
            <code className="font-mono" style={{ color: '#E8302A' }}>
              redbird.meta.json
            </code>{' '}
            — branding and theme
          </li>
        </ul>
        <p className="text-xs mt-1.5" style={{ color: '#666' }}>
          The server will restart automatically after save.
        </p>
      </div>

      {/* Seed data option */}
      <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-200 cursor-pointer transition-colors select-none">
        <input
          type="checkbox"
          checked={data.seedData}
          onChange={(e) => onChange({ seedData: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded accent-indigo-600 cursor-pointer"
        />
        <div>
          <p className="text-sm font-medium text-gray-900">Import sample data</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Adds demo products, categories, customers and orders so the backoffice is populated on
            first login
          </p>
        </div>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <button
          type="button"
          onClick={onLaunch}
          disabled={launching}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {launching ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            '🚀 Launch store'
          )}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderColor: 'var(--bo-border2)' }}
    >
      <span className="text-sm" style={{ color: 'var(--bo-muted)' }}>
        {label}
      </span>
      <span
        className="text-sm font-medium text-right max-w-[60%] truncate"
        style={{ color: 'var(--bo-text)' }}
      >
        {value}
      </span>
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
