import { useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'

const STATUS_LABELS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
} as const

export function ReturnsPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.returns.list.useQuery(
    filter ? { status: filter } : undefined,
  )

  const approveMut = trpc.admin.returns.approve.useMutation({
    onSuccess: () => utils.admin.returns.list.invalidate(),
  })
  const rejectMut = trpc.admin.returns.reject.useMutation({
    onSuccess: () => utils.admin.returns.list.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('returns.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('returns.subtitle')}</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">{t('common.loading')}</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-400">No return requests.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((r) => {
              const s = STATUS_LABELS[r.status]
              return (
                <div key={r.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                          {s.label}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {r.orderId.slice(0, 8)}…
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{r.reason}</p>
                      {r.adminNote && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Admin note: {r.adminNote}
                        </p>
                      )}
                    </div>

                    {r.status === 'pending' && (
                      <div className="shrink-0 flex flex-col gap-2 w-56">
                        <textarea
                          value={adminNote[r.id] ?? ''}
                          onChange={(e) => setAdminNote((n) => ({ ...n, [r.id]: e.target.value }))}
                          placeholder="Admin note (optional)"
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              approveMut.mutate({
                                id: r.id,
                                adminNote: adminNote[r.id] || undefined,
                              })
                            }
                            disabled={approveMut.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              rejectMut.mutate({
                                id: r.id,
                                adminNote: adminNote[r.id] || undefined,
                              })
                            }
                            disabled={rejectMut.isPending}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
