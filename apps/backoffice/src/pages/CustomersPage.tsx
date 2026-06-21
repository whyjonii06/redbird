import { keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { btnLink } from '../components/ui.js'
import { useI18n } from '../i18n/index.js'
import { fmtDate, trpc } from '../trpc.js'

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

export function CustomersPage() {
  const { t } = useI18n()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 20

  const { data, isLoading } = trpc.admin.customers.list.useQuery(
    { limit, offset, ...(search ? { search } : {}) },
    { placeholderData: keepPreviousData },
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('customers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const header = ['Email', 'First name', 'Last name', 'Date']
              const rows = (data ?? []).map((c) => [
                c.email,
                c.firstName ?? '',
                c.lastName ?? '',
                new Date(c.createdAt).toLocaleDateString('fr-FR'),
              ])
              downloadCsv(
                [header, ...rows],
                `customers-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{
              background: 'var(--bo-bg3)',
              border: '1px solid var(--bo-border)',
              color: 'var(--bo-muted)',
            }}
          >
            Export CSV
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOffset(0)
            }}
            placeholder={t('customers.searchPlaceholder')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Email
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Joined
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                  {t('customers.empty')}
                </td>
              </tr>
            )}
            {data?.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  <Link to={`/customers/${c.id}`} className="hover:text-indigo-600">
                    {c.firstName || c.lastName ? (
                      `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-gray-700">{c.email}</td>
                <td className="px-5 py-3.5 text-gray-500">{fmtDate(c.createdAt)}</td>
                <td className="px-5 py-3.5 text-right">
                  <Link to={`/customers/${c.id}`} className={btnLink}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">
            {t('common.page')} {Math.floor(offset / limit) + 1}
          </span>
          <button
            type="button"
            disabled={!data || data.length < limit}
            onClick={() => setOffset(offset + limit)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
