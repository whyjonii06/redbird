import { useState } from 'react'
import {
  ErrorAlert,
  btnLink,
  btnLinkDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  parseApiError,
} from '../components/ui.js'
import { trpc } from '../trpc.js'

type Flag = {
  key: string
  enabled: boolean
  rolloutPercent: number
  description: string | null
}

function FlagForm({
  existing,
  onSuccess,
  onCancel,
}: { existing?: Flag; onSuccess: () => void; onCancel: () => void }) {
  const [key, setKey] = useState(existing?.key ?? '')
  const [enabled, setEnabled] = useState(existing?.enabled ?? false)
  const [rolloutPercent, setRolloutPercent] = useState(existing?.rolloutPercent ?? 100)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [error, setError] = useState('')

  const upsertMut = trpc.admin.featureFlags.upsert.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsertMut.mutate({
      key: key.trim(),
      enabled,
      rolloutPercent,
      description: description.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-indigo-50 border border-indigo-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm">
        {existing ? `Edit "${existing.key}"` : 'New feature flag'}
      </h2>
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Key *</label>
          <input
            required
            disabled={Boolean(existing)}
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
            placeholder="new-checkout-flow"
            className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Rollout % <span className="text-gray-400 font-normal">(when enabled)</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={rolloutPercent}
            onChange={(e) => setRolloutPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this flag controls"
            className={inputCls}
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="ff-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="ff-enabled" className="text-sm text-gray-700">
            Enabled
          </label>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={upsertMut.isPending || !key.trim()} className={btnPrimary}>
          {upsertMut.isPending ? 'Saving…' : existing ? 'Save' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function FeatureFlagsPage() {
  const utils = trpc.useUtils()
  const { data: flags = [], isLoading } = trpc.admin.featureFlags.list.useQuery()
  const [showCreate, setShowCreate] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)

  const quickToggleMut = trpc.admin.featureFlags.upsert.useMutation({
    onSuccess: () => void utils.admin.featureFlags.list.invalidate(),
  })
  const deleteMut = trpc.admin.featureFlags.delete.useMutation({
    onSuccess: () => void utils.admin.featureFlags.list.invalidate(),
  })

  function invalidate() {
    void utils.admin.featureFlags.list.invalidate()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Feature flags</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Toggle experimental features or roll them out gradually, without a deploy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true)
            setEditKey(null)
          }}
          className={btnPrimary}
        >
          + New flag
        </button>
      </div>

      {showCreate && (
        <FlagForm
          onSuccess={() => {
            setShowCreate(false)
            invalidate()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : flags.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No feature flags yet. Create one to gate a beta feature or run a gradual rollout.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Key
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rollout
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) =>
                editKey === flag.key ? (
                  <tr key={flag.key} className="border-b border-gray-50">
                    <td colSpan={5} className="px-5 py-3">
                      <FlagForm
                        existing={flag}
                        onSuccess={() => {
                          setEditKey(null)
                          invalidate()
                        }}
                        onCancel={() => setEditKey(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={flag.key} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-900">
                      {flag.key}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">
                      {flag.description ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {flag.enabled ? `${flag.rolloutPercent}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          quickToggleMut.mutate({
                            key: flag.key,
                            enabled: !flag.enabled,
                            rolloutPercent: flag.rolloutPercent,
                            description: flag.description ?? undefined,
                          })
                        }
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          flag.enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditKey(flag.key)}
                        className={btnLink}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete flag "${flag.key}"?`)) {
                            deleteMut.mutate({ key: flag.key })
                          }
                        }}
                        className={btnLinkDanger}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
