import { useState } from 'react'
import { fmt, trpc } from '../trpc.js'

const STATUS_LABELS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700' },
} as const

export function SellersPage() {
  const [filter, setFilter] = useState<'' | 'pending' | 'active' | 'suspended'>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const { data, isLoading, error } = trpc.admin.sellers.list.useQuery(
    filter ? { status: filter } : undefined,
  )

  const approveMut = trpc.admin.sellers.approve.useMutation({
    onSuccess: () => utils.admin.sellers.list.invalidate(),
  })
  const suspendMut = trpc.admin.sellers.suspend.useMutation({
    onSuccess: () => utils.admin.sellers.list.invalidate(),
  })
  const setRateMut = trpc.admin.sellers.setCommissionRate.useMutation({
    onSuccess: () => utils.admin.sellers.list.invalidate(),
  })
  const payoutMut = trpc.admin.sellers.createPayout.useMutation({
    onSuccess: () => utils.admin.sellers.listEarnings.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Sellers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Approve marketplace vendor applications, set commission rates, and issue payouts.
        </p>
      </div>

      <div className="flex gap-2">
        {(['', 'pending', 'active', 'suspended'] as const).map((s) => (
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
        {error?.data?.code === 'UNAUTHORIZED' ? (
          <div className="p-12 text-center text-sm text-red-600">
            Admin or owner access required to manage sellers.
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-400">No sellers.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((s) => {
              const status = STATUS_LABELS[s.status]
              const isExpanded = expanded === s.id
              return (
                <div key={s.id} className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}
                        >
                          {status.label}
                        </span>
                        <p className="text-sm font-medium text-gray-900">{s.storeName}</p>
                      </div>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => approveMut.mutate({ id: s.id })}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium"
                        >
                          Approve
                        </button>
                      )}
                      {s.status !== 'suspended' && (
                        <button
                          type="button"
                          onClick={() => suspendMut.mutate({ id: s.id })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Suspend
                        </button>
                      )}
                      {s.status === 'suspended' && (
                        <button
                          type="button"
                          onClick={() => approveMut.mutate({ id: s.id })}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Reinstate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <label htmlFor={`rate-${s.id}`} className="text-xs text-gray-500">
                          Commission rate (%, blank = marketplace default)
                        </label>
                        <input
                          id={`rate-${s.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={s.commissionRateBp != null ? s.commissionRateBp / 100 : ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            setRateMut.mutate({
                              id: s.id,
                              commissionRateBp: v ? Math.round(Number(v) * 100) : null,
                            })
                          }}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <SellerEarnings
                        sellerId={s.id}
                        onPayout={(note) => payoutMut.mutate({ id: s.id, note })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SellerEarnings({
  sellerId,
  onPayout,
}: { sellerId: string; onPayout: (note?: string) => void }) {
  const { data: earnings = [] } = trpc.admin.sellers.listEarnings.useQuery({ id: sellerId })
  const available = earnings.filter((e) => e.status === 'available')
  const availableTotal = available.reduce((sum, e) => sum + e.netAmount, 0)
  const currency = earnings[0]?.currency ?? 'EUR'

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-700">
        Available balance: <span className="font-semibold">{fmt(availableTotal, currency)}</span>{' '}
        <span className="text-xs text-gray-400">({available.length} order(s))</span>
      </p>
      <button
        type="button"
        disabled={available.length === 0}
        onClick={() => onPayout()}
        className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
      >
        Issue payout
      </button>
    </div>
  )
}
