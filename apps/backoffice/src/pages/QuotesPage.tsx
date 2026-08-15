import { useState } from 'react'
import { fmt, trpc } from '../trpc.js'

const STATUS_LABELS = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  quoted: { label: 'Quoted', cls: 'bg-indigo-100 text-indigo-700' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
} as const

type StatusFilter = '' | keyof typeof STATUS_LABELS

export function QuotesPage() {
  const [filter, setFilter] = useState<StatusFilter>('')
  const [staffNote, setStaffNote] = useState<Record<string, string>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.quotes.list.useQuery(
    filter ? { status: filter } : undefined,
  )

  const respondMut = trpc.admin.quotes.respond.useMutation({
    onSuccess: () => utils.admin.quotes.list.invalidate(),
  })
  const rejectMut = trpc.admin.quotes.reject.useMutation({
    onSuccess: () => utils.admin.quotes.list.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Quote requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set a negotiated price per item and send it back to the customer for acceptance.
        </p>
      </div>

      <div className="flex gap-2">
        {(['', 'pending', 'quoted', 'accepted', 'rejected', 'expired'] as const).map((s) => (
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
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-400">No quote requests.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((q) => {
              const s = STATUS_LABELS[q.status]
              const canRespond = q.status === 'pending'
              return (
                <div key={q.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                          {s.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {q.customerNote && (
                        <p className="text-sm text-gray-700 mt-2 italic">"{q.customerNote}"</p>
                      )}

                      <div className="mt-3 space-y-2">
                        {q.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 text-sm">
                            <span className="text-gray-700 flex-1 min-w-0 truncate">
                              {item.quantity} × {item.variant?.productName ?? 'Unknown item'}
                              {item.variant?.variantName && (
                                <span className="text-gray-400"> — {item.variant.variantName}</span>
                              )}
                              {item.variant?.sku && (
                                <span className="text-gray-400 font-mono">
                                  {' '}
                                  ({item.variant.sku})
                                </span>
                              )}
                            </span>
                            {canRespond ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-gray-400">unit price</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder={
                                    item.variant ? String(item.variant.priceAmount / 100) : '0.00'
                                  }
                                  value={prices[item.id] ?? ''}
                                  onChange={(e) =>
                                    setPrices((p) => ({ ...p, [item.id]: e.target.value }))
                                  }
                                  className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                                />
                              </div>
                            ) : (
                              item.quotedPriceAmount != null && (
                                <span className="text-xs font-medium text-gray-900 shrink-0">
                                  {fmt(item.quotedPriceAmount, q.currency)} / unit
                                </span>
                              )
                            )}
                          </div>
                        ))}
                      </div>

                      {q.staffNote && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          Staff note: {q.staffNote}
                        </p>
                      )}
                    </div>

                    {canRespond && (
                      <div className="shrink-0 flex flex-col gap-2 w-56">
                        <textarea
                          value={staffNote[q.id] ?? ''}
                          onChange={(e) => setStaffNote((n) => ({ ...n, [q.id]: e.target.value }))}
                          placeholder="Note to customer (optional)"
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const items = q.items.map((item) => ({
                                itemId: item.id,
                                quotedPriceAmount: Math.round(
                                  Number(
                                    prices[item.id] ??
                                      (item.variant ? item.variant.priceAmount / 100 : 0),
                                  ) * 100,
                                ),
                              }))
                              respondMut.mutate({
                                id: q.id,
                                items,
                                ...(staffNote[q.id] ? { staffNote: staffNote[q.id] } : {}),
                              })
                            }}
                            disabled={respondMut.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Send quote
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              rejectMut.mutate({
                                id: q.id,
                                staffNote: staffNote[q.id] || undefined,
                              })
                            }
                            disabled={rejectMut.isPending}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Decline
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
