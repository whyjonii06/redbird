import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '../components/Badge.js'
import { StatCard } from '../components/StatCard.js'
import { useI18n } from '../i18n/index.js'
import { fmt, fmtDate, trpc } from '../trpc.js'

const HEALTH_ITEMS = [
  {
    label: 'Payment',
    hint: 'Accept online payments',
    anchor: 'Payment',
    plugins: ['@redbird/plugin-stripe', '@redbird/plugin-paypal'],
  },
  {
    label: 'Email',
    hint: 'Order confirmations & alerts',
    anchor: 'Email',
    plugins: ['@redbird/plugin-email-resend', '@redbird/plugin-email-smtp'],
  },
  {
    label: 'Shipping',
    hint: 'Calculate delivery costs',
    anchor: 'Shipping',
    plugins: ['@redbird/plugin-shipping-flat', '@redbird/plugin-shipping-zones'],
  },
  {
    label: 'Tax',
    hint: 'Apply taxes to orders',
    anchor: 'Tax',
    plugins: ['@redbird/plugin-tax-rules', '@redbird/plugin-vat-eu'],
  },
]

function StoreHealth() {
  const { t } = useI18n()
  const { data: plugins = [] } = trpc.admin.plugins.list.useQuery()
  const activeNames = new Set(plugins.map((p) => p.name))

  const items = HEALTH_ITEMS.map((item) => ({
    ...item,
    active: item.plugins.some((p) => activeNames.has(p)),
  }))

  if (items.every((i) => i.active)) return null

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-orange-800">{t('dash.healthTitle')}</p>
        <p className="text-xs text-orange-600 mt-0.5">{t('dash.healthHint')}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border p-3.5 space-y-1.5 ${
              item.active ? 'bg-white border-green-200' : 'bg-white border-orange-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${item.active ? 'bg-green-500' : 'bg-orange-400'}`}
              />
              <span className="text-sm font-semibold text-gray-800">
                {t(`dash.health.${item.label}`)}
              </span>
            </div>
            <p className="text-xs text-gray-500">{t(`dash.healthHint.${item.anchor}`)}</p>
            {item.active ? (
              <p className="text-xs font-medium text-green-600">{t('dash.active')}</p>
            ) : (
              <Link
                to={`/marketplace#category-${item.anchor}`}
                className="text-xs font-medium text-orange-600 hover:text-orange-800 transition-colors"
              >
                {t('dash.configure')}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useI18n()
  const { data, isLoading, error } = trpc.admin.stats.overview.useQuery()

  if (isLoading)
    return (
      <PageShell>
        <div className="text-gray-400 text-sm">{t('common.loading')}</div>
      </PageShell>
    )
  if (error)
    return (
      <PageShell>
        <div className="text-red-500 text-sm">{t('common.error', { msg: error.message })}</div>
      </PageShell>
    )
  if (!data) return null

  const chartData = [
    { name: t('status.pending'), value: data.ordersByStatus.pending, fill: '#fbbf24' },
    { name: t('status.paid'), value: data.ordersByStatus.paid, fill: '#60a5fa' },
    { name: t('status.fulfilled'), value: data.ordersByStatus.fulfilled, fill: '#34d399' },
    { name: t('status.cancelled'), value: data.ordersByStatus.cancelled, fill: '#f87171' },
    { name: t('status.refunded'), value: data.ordersByStatus.refunded, fill: '#9ca3af' },
  ]

  const currency = data.recentOrders[0]?.currency ?? 'EUR'

  return (
    <PageShell>
      <StoreHealth />

      {/* Action required */}
      {(data.ordersByStatus.paid > 0 || data.lowStockTotal > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.ordersByStatus.paid > 0 && (
            <Link
              to="/orders"
              className="block rounded-xl p-4 transition-colors"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--bo-text)' }}>
                    {t(data.ordersByStatus.paid === 1 ? 'dash.toFulfill' : 'dash.toFulfill_plural', {
                      n: data.ordersByStatus.paid,
                    })}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--bo-muted)' }}>
                    {t('dash.toFulfillHint')}
                  </p>
                </div>
              </div>
            </Link>
          )}
          {data.lowStockTotal > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">⚠️</span>
                <p className="text-lg font-bold" style={{ color: 'var(--bo-text)' }}>
                  {t(data.lowStockTotal === 1 ? 'dash.lowStock' : 'dash.lowStock_plural', {
                    n: data.lowStockTotal,
                  })}
                </p>
              </div>
              <ul className="space-y-1">
                {data.lowStock.map((s) => (
                  <li key={s.sku} className="text-xs">
                    <Link
                      to={`/products/${s.productId}`}
                      className="hover:underline"
                      style={{ color: 'var(--bo-muted)' }}
                    >
                      {s.productName} <span className="font-mono">({s.sku})</span> —{' '}
                      <span style={{ color: s.available === 0 ? '#ef4444' : '#f59e0b' }}>
                        {t('dash.left', { n: s.available })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t('dash.totalOrders')} value={data.totalOrders} />
        <StatCard
          label={t('dash.revenue')}
          value={fmt(data.totalRevenue, currency)}
          sub={t('dash.revenueSub')}
        />
        <StatCard label={t('dash.products')} value={data.productCount} />
        <StatCard label={t('dash.customers')} value={data.customerCount} />
      </div>

      {/* Revenue over time */}
      <div className="bg-gray-100 border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('dash.revenue30')}</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data.revenueChart.map((d) => ({ ...d, amount: d.amount / 100 }))}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8302A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#E8302A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(d: string) => d.slice(5)}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#888' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${currency} ${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: '#161616',
                border: '1px solid #1e1e1e',
                borderRadius: 8,
                color: '#f5f5f5',
              }}
              formatter={(v: number) => [`${currency} ${v.toFixed(2)}`, 'Revenue']}
              labelFormatter={(l: string) => l}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#E8302A"
              strokeWidth={2}
              fill="url(#rev)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Orders by status chart */}
        <div className="bg-gray-100 border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('dash.ordersByStatus')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#888' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#888' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{
                  background: '#161616',
                  border: '1px solid #1e1e1e',
                  borderRadius: 8,
                  color: '#f5f5f5',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <rect key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent orders */}
        <div className="bg-gray-100 border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">{t('dash.recentOrders')}</h2>
            <Link to="/orders" className="text-xs text-indigo-600 hover:underline">
              {t('dash.viewAll')}
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentOrders.length === 0 && (
              <p className="text-sm text-gray-400">{t('dash.noOrders')}</p>
            )}
            {data.recentOrders.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.number}</p>
                  <p className="text-xs text-gray-400">
                    {o.customerEmail} · {fmtDate(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge value={o.status} />
                  <span className="text-sm font-semibold text-gray-800">
                    {fmt(o.totalAmount, o.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('dash.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('dash.overview')}</p>
      </div>
      {children}
    </div>
  )
}
