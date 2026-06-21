import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { btnPrimary, inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

const MODULE_NAME = '@redbird/plugin-reviews'

/**
 * Configuration page for the reviews module. Reads/writes settings through the
 * shared plugin config store (`admin.plugins.getConfig` / `saveConfig`), which
 * the module reads back at runtime to apply auto-approval and a minimum rating.
 */
export function ReviewsConfigPage() {
  const utils = trpc.useUtils()
  const { data: allConfig } = trpc.admin.plugins.getConfig.useQuery()
  const [autoApprove, setAutoApprove] = useState(false)
  const [minRating, setMinRating] = useState('1')
  const [saved, setSaved] = useState(false)

  const saveMut = trpc.admin.plugins.saveConfig.useMutation({
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      void utils.admin.plugins.getConfig.invalidate()
    },
  })

  useEffect(() => {
    const cfg = allConfig?.[MODULE_NAME]
    if (cfg) {
      setAutoApprove(cfg.autoApprove === 'true')
      if (cfg.minRating) setMinRating(cfg.minRating)
    }
  }, [allConfig])

  function save() {
    saveMut.mutate({
      pluginName: MODULE_NAME,
      config: { autoApprove: String(autoApprove), minRating: minRating },
    })
  }

  return (
    <div className="p-8 space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Reviews settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure how customer reviews are handled</p>
        </div>
        <Link to="/reviews" className="text-xs font-medium text-indigo-500 hover:text-indigo-600">
          ← Back to reviews
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-100 p-6 space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">Auto-approve reviews</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Publish new reviews immediately instead of holding them for moderation.
            </span>
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Minimum rating</label>
          <p className="text-xs text-gray-500 mb-2">
            Reject submissions below this star rating (1 accepts all).
          </p>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className={inputCls}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n} star{n > 1 ? 's' : ''} minimum
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={save} disabled={saveMut.isPending} className={btnPrimary}>
            {saveMut.isPending ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span className="text-xs font-medium text-green-600">✓ Saved</span>}
        </div>
      </div>
    </div>
  )
}
