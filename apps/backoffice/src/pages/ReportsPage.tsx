import { useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { fmt, trpc } from '../trpc.js'

function downloadCsvString(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-500">From</label>
      <input
        type="date"
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900"
      />
      <label className="text-gray-500">To</label>
      <input
        type="date"
        value={to}
        onChange={(e) => onTo(e.target.value)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900"
      />
    </div>
  )
}

function BestSellersSection() {
  const { t } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data: currencyConfig } = trpc.admin.currency.get.useQuery()
  const baseCurrency = currencyConfig?.base ?? 'EUR'

  const { data: rows = [], isLoading } = trpc.admin.reports.bestSellers.useQuery({
    from: from || undefined,
    to: to || undefined,
    limit: 20,
  })
  const { refetch: refetchExport, isFetching: exporting } =
    trpc.admin.reports.exportBestSellers.useQuery(
      { from: from || undefined, to: to || undefined },
      { enabled: false },
    )

  async function handleExport() {
    const result = await refetchExport()
    if (!result.data) return
    downloadCsvString(result.data, `best-sellers-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Best sellers</h2>
        <div className="flex items-center gap-3">
          <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="border border-gray-200 bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? t('common.exporting') : t('common.exportCsv')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">No sales in this period.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                Product
              </th>
              <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">SKU</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                Qty sold
              </th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku} className="border-b border-gray-100">
                <td className="py-2.5 text-gray-900 font-medium">
                  {r.productName}
                  {r.variantName && r.variantName !== r.productName && (
                    <span className="text-gray-400 font-normal"> — {r.variantName}</span>
                  )}
                </td>
                <td className="py-2.5 text-gray-500 font-mono text-xs">{r.sku}</td>
                <td className="py-2.5 text-right text-gray-900">{r.quantitySold}</td>
                <td className="py-2.5 text-right text-gray-900 font-semibold">
                  {fmt(r.revenue, baseCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OrdersExportSection() {
  const { t } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { refetch, isFetching } = trpc.admin.reports.exportOrders.useQuery(
    { from: from || undefined, to: to || undefined },
    { enabled: false },
  )

  async function handleExport() {
    const result = await refetch()
    if (!result.data) return
    downloadCsvString(result.data, `orders-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Orders export</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Download all orders in the selected range as CSV.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isFetching}
            className="border border-gray-200 bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isFetching ? t('common.exporting') : t('common.exportCsv')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CohortsSection() {
  const { t } = useI18n()
  const { data: cohorts = [], isLoading } = trpc.admin.reports.cohorts.useQuery({ months: 6 })
  const maxOffset = Math.max(0, ...cohorts.map((c) => c.retention.length - 1))

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Customer retention by cohort</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          % of each signup month's customers who placed an order in each following month.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
      ) : cohorts.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          Not enough signups yet to compute cohorts.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                  Cohort
                </th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                  Size
                </th>
                {Array.from({ length: maxOffset + 1 }).map((_, i) => (
                  <th
                    key={`m${i}`}
                    className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase"
                  >
                    M{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort} className="border-b border-gray-100">
                  <td className="py-2.5 pr-4 text-gray-900 font-medium">{c.cohort}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-500">{c.size}</td>
                  {Array.from({ length: maxOffset + 1 }).map((_, i) => {
                    const pct = c.retention[i]
                    return (
                      <td key={`m${i}`} className="py-2.5 px-3 text-right">
                        {pct === undefined ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{
                              background: `rgba(79,70,229,${Math.max(0.06, pct / 100)})`,
                              color: pct > 50 ? '#fff' : '#4338ca',
                            }}
                          >
                            {pct}%
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Best sellers, customer retention, and CSV exports.
        </p>
      </div>
      <BestSellersSection />
      <CohortsSection />
      <OrdersExportSection />
    </div>
  )
}
