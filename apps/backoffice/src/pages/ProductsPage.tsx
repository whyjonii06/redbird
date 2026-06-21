import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '../components/Badge.js'
import { useI18n } from '../i18n/index.js'
import { fmt, trpc } from '../trpc.js'

export function ProductsPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<'' | 'draft' | 'active' | 'archived'>('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const limit = 20
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const searching = search.trim().length > 0
  const { data, isLoading } = trpc.admin.catalog.list.useQuery({
    status: status || undefined,
    ...(searching ? { search: search.trim() } : {}),
    limit,
    offset: searching ? 0 : offset,
  })
  const { data: total } = trpc.admin.catalog.count.useQuery({ status: status || undefined })

  const del = trpc.admin.catalog.delete.useMutation()

  function handleDelete(id: string, name: string) {
    if (confirm(t('products.confirmDelete', { name }))) {
      del.mutate({ id }, { onSuccess: () => utils.admin.catalog.list.invalidate() })
    }
  }

  async function handleBulkDelete() {
    if (!confirm(t('products.confirmBulkDelete', { n: selected.size }))) return
    await Promise.all([...selected].map((id) => del.mutateAsync({ id })))
    setSelected(new Set())
    await utils.admin.catalog.list.invalidate()
    await utils.admin.catalog.count.invalidate()
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
      prev.size === (data?.length ?? 0) ? new Set() : new Set((data ?? []).map((p) => p.id)),
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('products.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total !== undefined
              ? t('products.subtitleCount', { n: total })
              : t('products.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <CsvExportButton />
          <Link
            to="/products/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {t('products.new')}
          </Link>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
          placeholder={t('products.searchPlaceholder')}
          className="flex-1 min-w-56 text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {(['', 'active', 'draft', 'archived'] as const).map((s) => (
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
          <span className="text-sm text-indigo-700">
            {t('common.selected', { n: selected.size })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              {t('common.clear')}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={del.isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t('products.deleteSelected')}
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
                {t('products.colName')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('products.colSlug')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('common.status')}
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('products.colVariants')}
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('products.colPrice')}
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <p className="text-gray-400 text-sm">
                    {searching ? t('products.noMatch', { q: search }) : t('products.empty')}
                  </p>
                  {!searching && (
                    <Link
                      to="/products/new"
                      className="mt-2 inline-block text-indigo-600 text-sm hover:underline"
                    >
                      {t('products.emptyCreate')}
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {data?.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="font-medium text-gray-900 hover:text-indigo-600 text-left"
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{p.slug}</td>
                <td className="px-5 py-3.5">
                  <Badge value={p.status} />
                </td>
                <td className="px-5 py-3.5 text-gray-600">{p.variants.length}</td>
                <td className="px-5 py-3.5 text-right text-gray-700">
                  {p.variants[0]
                    ? fmt(p.variants[0].priceAmount, p.variants[0].priceCurrency)
                    : '—'}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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

function CsvExportButton() {
  const { t } = useI18n()
  const { refetch, isFetching } = trpc.admin.catalog.exportCsv.useQuery(undefined, {
    enabled: false,
  })

  async function handleExport() {
    const result = await refetch()
    if (!result.data) return
    const blob = new Blob([result.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={isFetching}
      className="border border-gray-200 bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {isFetching ? t('common.exporting') : t('common.exportCsv')}
    </button>
  )
}
