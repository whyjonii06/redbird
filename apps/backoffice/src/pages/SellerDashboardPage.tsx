import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearSellerToken } from '../auth.js'
import { fmt, trpc } from '../trpc.js'

const STATUS_BANNER: Record<string, { text: string; cls: string } | undefined> = {
  pending: {
    text: 'Your seller account is awaiting staff approval. You can prepare products as drafts in the meantime.',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  suspended: {
    text: 'Your seller account has been suspended. Contact the store to resolve this.',
    cls: 'bg-red-50 text-red-800 border-red-200',
  },
}

export function SellerDashboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'products' | 'orders' | 'earnings'>('products')
  const { data: seller, isLoading } = trpc.sellers.me.useQuery()

  function signOut() {
    clearSellerToken()
    navigate('/seller/login')
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>
  }
  if (!seller) {
    navigate('/seller/login')
    return null
  }

  const banner = STATUS_BANNER[seller.status]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-bold text-gray-900">{seller.storeName}</p>
          <p className="text-xs text-gray-400">{seller.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {banner && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${banner.cls}`}>{banner.text}</div>
        )}

        <div className="flex gap-2">
          {(['products', 'orders', 'earnings'] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'products' && <ProductsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'earnings' && <EarningsTab />}
      </div>
    </div>
  )
}

function ProductsTab() {
  const utils = trpc.useUtils()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')

  const { data: products = [], isLoading } = trpc.sellers.myProducts.list.useQuery()

  const createMut = trpc.sellers.myProducts.create.useMutation({
    onSuccess: () => {
      void utils.sellers.myProducts.list.invalidate()
      setAdding(false)
      setName('')
      setSlug('')
      setSku('')
      setPrice('')
    },
  })
  const updateMut = trpc.sellers.myProducts.update.useMutation({
    onSuccess: () => void utils.sellers.myProducts.list.invalidate(),
  })
  const deleteMut = trpc.sellers.myProducts.delete.useMutation({
    onSuccess: () => void utils.sellers.myProducts.list.invalidate(),
  })
  const setStockMut = trpc.sellers.myProducts.setStock.useMutation({
    onSuccess: () => void utils.sellers.myProducts.list.invalidate(),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">My products</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm text-red-600 hover:underline"
          >
            + Add product
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate({
              name,
              slug,
              variant: {
                sku,
                name: 'Default',
                priceAmount: Math.round(Number(price || '0') * 100),
                priceCurrency: 'EUR',
              },
            })
          }}
          className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="URL slug"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              required
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {createMut.error && <p className="text-xs text-red-600">{createMut.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-sm text-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-400">No products yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {products.map((p) => {
            const variant = p.variants[0]
            return (
              <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {variant?.sku} ·{' '}
                    {variant ? fmt(variant.priceAmount, variant.priceCurrency) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {variant && (
                    <input
                      type="number"
                      min="0"
                      defaultValue={variant.stockLevel?.available ?? 0}
                      onBlur={(e) =>
                        setStockMut.mutate({
                          variantId: variant.id,
                          quantity: Number(e.target.value),
                        })
                      }
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                      title="Stock"
                    />
                  )}
                  <select
                    value={p.status}
                    onChange={(e) =>
                      updateMut.mutate({
                        id: p.id,
                        status: e.target.value as 'draft' | 'active' | 'archived',
                      })
                    }
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate({ id: p.id })}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const { data: ordersList = [], isLoading } = trpc.sellers.myOrders.useQuery()

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (ordersList.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm text-gray-400">No orders yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {ordersList.map((o) => (
        <div key={o.orderId} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">#{o.orderNumber}</p>
            <span className="text-xs text-gray-400">
              {new Date(o.createdAt).toLocaleDateString()} · {o.orderStatus}
            </span>
          </div>
          <ul className="space-y-0.5">
            {o.lineItems.map((li) => (
              <li key={li.id} className="text-xs text-gray-600">
                {li.quantity} × {li.productName} — {fmt(li.totalAmount, 'EUR')}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function EarningsTab() {
  const { data: earnings = [], isLoading } = trpc.sellers.myEarnings.useQuery()

  const available = earnings.filter((e) => e.status === 'available')
  const availableTotal = available.reduce((sum, e) => sum + e.netAmount, 0)
  const currency = earnings[0]?.currency ?? 'EUR'

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Available balance</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(availableTotal, currency)}</p>
        </div>
        <p className="text-xs text-gray-400">
          Payouts are issued by the store — contact them once you'd like a transfer.
        </p>
      </div>

      {earnings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-400">No earnings yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {earnings.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">{fmt(e.netAmount, e.currency)} net</p>
                <p className="text-xs text-gray-400">
                  {fmt(e.grossAmount, e.currency)} gross − {fmt(e.commissionAmount, e.currency)}{' '}
                  commission
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  e.status === 'paid_out'
                    ? 'bg-green-100 text-green-700'
                    : e.status === 'available'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {e.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
