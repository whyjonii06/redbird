import { useState } from 'react'
import { btnLink } from '../components/ui.js'
import { fmt, trpc } from '../trpc.js'

type Subscription = {
  id: string
  productName: string
  variantName: string
  sku: string
  priceAmount: number
  priceCurrency: string
  quantity: number
  interval: 'weekly' | 'monthly' | 'yearly'
  status: 'active' | 'paused' | 'cancelled'
  nextRenewalAt: string
  lastReminderSentAt: string | null
}

const STATUS_CLASS: Record<Subscription['status'], string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export function SubscriptionsPage() {
  const utils = trpc.useUtils()
  const { data: subs = [], isLoading } = trpc.admin.subscriptions.list.useQuery()
  const [runResult, setRunResult] = useState<{ due: number; reminded: number } | null>(null)

  const pauseMut = trpc.admin.subscriptions.pause.useMutation({
    onSuccess: () => void utils.admin.subscriptions.list.invalidate(),
  })
  const resumeMut = trpc.admin.subscriptions.resume.useMutation({
    onSuccess: () => void utils.admin.subscriptions.list.invalidate(),
  })
  const cancelMut = trpc.admin.subscriptions.cancel.useMutation({
    onSuccess: () => void utils.admin.subscriptions.list.invalidate(),
  })
  const runRemindersMut = trpc.admin.subscriptions.runReminders.useMutation({
    onSuccess: (result) => {
      setRunResult(result)
      void utils.admin.subscriptions.list.invalidate()
    },
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Recurring order schedules with renewal-reminder emails. This does not auto-charge — no
            payment provider here supports off-session billing, so customers get a reminder email
            with a reorder link each cycle instead.
          </p>
        </div>
        <button
          type="button"
          disabled={runRemindersMut.isPending}
          onClick={() => runRemindersMut.mutate()}
          className="border border-gray-200 bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {runRemindersMut.isPending ? 'Running…' : 'Run reminders now'}
        </button>
      </div>

      {runResult && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          {runResult.due} due, {runResult.reminded} reminder{runResult.reminded === 1 ? '' : 's'}{' '}
          sent.
        </p>
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No subscriptions yet. Customers can subscribe from a product page.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Price
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Interval
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Next renewal
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {s.quantity} × {s.productName}
                    {s.variantName && (
                      <span className="text-gray-400 font-normal"> — {s.variantName}</span>
                    )}
                    <div className="text-xs text-gray-400 font-mono">{s.sku}</div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {fmt(s.priceAmount, s.priceCurrency)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 capitalize">{s.interval}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">
                    {new Date(s.nextRenewalAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    {s.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => pauseMut.mutate({ id: s.id })}
                        className={btnLink}
                      >
                        Pause
                      </button>
                    )}
                    {s.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => resumeMut.mutate({ id: s.id })}
                        className={btnLink}
                      >
                        Resume
                      </button>
                    )}
                    {s.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Cancel this subscription for ${s.productName}?`)) {
                            cancelMut.mutate({ id: s.id })
                          }
                        }}
                        className={btnLink}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
