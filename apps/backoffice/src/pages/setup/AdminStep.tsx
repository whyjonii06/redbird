import { useState } from 'react'
import { BackBtn } from './ModulesStep.js'
import type { SetupData } from './types.js'

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onNext: () => void
  onBack: () => void
}

export function AdminStep({ data, onChange, onNext, onBack }: Props) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  function copy() {
    navigator.clipboard.writeText(data.adminKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function regen() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const key = Array.from(
      { length: 24 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('')
    onChange({ adminKey: key })
    setConfirmed(false)
  }

  const valid = data.adminKey.length >= 8 && confirmed

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Admin access</h2>
        <p className="text-sm text-gray-500 mt-1">Your key to access this back office</p>
      </div>

      <div
        className="rounded-xl p-4 text-sm"
        style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          color: '#fbbf24',
        }}
      >
        ⚠️ Save your key before continuing — it won't be shown again. If lost, edit{' '}
        <code className="font-mono px-1 rounded" style={{ background: 'rgba(251,191,36,0.15)' }}>
          .env
        </code>{' '}
        manually.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin key</label>
        <div className="flex gap-2">
          <input
            value={data.adminKey}
            onChange={(e) => {
              onChange({ adminKey: e.target.value })
              setConfirmed(false)
            }}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={copy}
            className="px-3 rounded-lg text-sm whitespace-nowrap transition-colors"
            style={{
              border: '1px solid #2a2a2a',
              color: 'var(--bo-muted)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bo-border)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {copied ? '✓' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={regen}
            title="Generate new key"
            className="px-3 rounded-lg transition-colors"
            style={{
              border: '1px solid #2a2a2a',
              color: 'var(--bo-muted)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bo-border)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ↻
          </button>
        </div>
        {data.adminKey.length > 0 && data.adminKey.length < 8 && (
          <p className="text-xs text-red-500 mt-1">Minimum 8 characters</p>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-4 h-4 accent-indigo-600"
        />
        <span className="text-sm text-gray-600">I've saved my admin key somewhere safe</span>
      </label>

      <div className="flex gap-3 pt-2">
        <BackBtn onClick={onBack} />
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Review & Launch →
        </button>
      </div>
    </div>
  )
}
