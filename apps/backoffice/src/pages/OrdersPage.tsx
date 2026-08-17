import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge.js'
import { useI18n } from '../i18n/index.js'
import { fmt, fmtDate, trpc } from '../trpc.js'

function downloadCsv(rows: string[][], filename: string) {
  const content = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const statuses = ['', 'pending', 'paid', 'fulfilled', 'cancelled', 'refunded'] as const

export function OrdersPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<
    '' | 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
  >('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const limit = 20
  const utils = trpc.useUtils()

  const searching = search.trim().length > 0
  const { data, isLoading } = trpc.admin.orders.list.useQuery({
    status: status || undefined,
    ...(searching ? { search: search.trim() } : {}),
    limit,
    offset: searching ? 0 : offset,
  })
  const { data: total } = trpc.admin.orders.count.useQuery({ status: status || undefined })

  const fulfillMut = trpc.admin.orders.markFulfilled.useMutation()

  async function handleBulkFulfill() {
    const ids = [...selected]
    if (!confirm(t('orders.confirmBulkFulfill', { n: ids.length }))) return
    await Promise.all(ids.map((id) => fulfillMut.mutateAsync({ id }).catch(() => {})))
    setSelected(new Set())
    await utils.admin.orders.list.invalidate()
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === (data?.length ?? 0) ? new Set() : new Set((data ?? []).map((o) => o.id)),
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('orders.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total !== undefined
              ? t('orders.subtitleCount', { n: total })
              : t('orders.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const header = ['Number', 'Status', 'Total', 'Currency', 'Customer', 'Date']
            const rows = (data ?? []).map((o) => [
              o.number.toString(),
              o.status,
              (o.totalAmount / 100).toFixed(2),
              o.currency,
              o.customerEmail ?? '',
              new Date(o.createdAt).toLocaleDateString('fr-FR'),
            ])
            downloadCsv([header, ...rows], `orders-${new Date().toISOString().slice(0, 10)}.csv`)
          }}
          className="px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{
            background: 'var(--bo-bg3)',
            border: '1px solid var(--bo-border)',
            color: 'var(--bo-muted)',
          }}
        >
          {t('common.exportCsv')}
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
          placeholder={t('orders.searchPlaceholder')}
          className="flex-1 min-w-56 text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-gray-100 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {statuses.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => {
              setStatus(s)
              setOffset(0)
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s ? t(`status.${s}`) : t('common.all')}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
          <span className="text-sm text-indigo-700">
            {t('common.selected', { n: selected.size })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-50"
            >
              {t('common.clear')}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkFulfill()}
              disabled={fulfillMut.isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('orders.markFulfilled')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-10 px-5 py-3.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={data ? data.length > 0 && selected.size === data.length : false}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('orders.colOrder')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('orders.colCustomer')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('common.date')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('common.status')}
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('common.total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                  {t('orders.empty')}
                </td>
              </tr>
            )}
            {data?.map((o) => (
              <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    aria-label={`Select order ${o.number}`}
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    to={`/orders/${o.id}`}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {o.number}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-gray-700">{o.customerEmail}</td>
                <td className="px-5 py-3.5 text-gray-500">{fmtDate(o.createdAt)}</td>
                <td className="px-5 py-3.5">
                  <Badge value={o.status} />
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-gray-800">
                  {fmt(o.totalAmount, o.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {!searching && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-500">
              {t('common.page')} {Math.floor(offset / limit) + 1}
              {total !== undefined && ` ${t('common.of')} ${Math.max(1, Math.ceil(total / limit))}`}
            </span>
            <button
              type="button"
              disabled={!data || data.length < limit}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
