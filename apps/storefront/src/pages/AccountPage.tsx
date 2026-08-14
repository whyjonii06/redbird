import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext.js'
import { fmt, trpc } from '../trpc.js'

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AccountPage() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(customer?.firstName ?? '')
  const [lastName, setLastName] = useState(customer?.lastName ?? '')

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(customer?.marketingOptIn ?? false)

  const updateMut = trpc.customers.update.useMutation({
    onSuccess() {
      setEditing(false)
    },
  })
  const optInMut = trpc.customers.update.useMutation({
    onSuccess(updated) {
      setMarketingOptIn(updated.marketingOptIn)
    },
  })

  const ordersQuery = trpc.customers.orders.useQuery()
  const exportQuery = trpc.customers.exportData.useQuery(undefined, { enabled: false })
  const deleteAccountMut = trpc.customers.deleteAccount.useMutation({
    onSuccess() {
      logout()
      navigate('/?account=deleted')
    },
  })

  function handleLogout() {
    logout()
    navigate('/')
  }

  function handleExport() {
    exportQuery.refetch().then(({ data }) => {
      if (data)
        downloadJson(data, `redbird-data-export-${new Date().toISOString().slice(0, 10)}.json`)
    })
  }

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">You need to sign in to view your account.</p>
        <Link to="/login" className="bg-[var(--primary)] text-white px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My account</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </div>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Profile</h2>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setFirstName(customer.firstName ?? '')
                setLastName(customer.lastName ?? '')
                setEditing(true)
              }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateMut.mutate({
                firstName: firstName || undefined,
                lastName: lastName || undefined,
              })
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="f-4" className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <input
                  id="f-4"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="f-5" className="block text-sm font-medium text-gray-700 mb-1">
                  Last name
                </label>
                <input
                  id="f-5"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateMut.isPending}
                className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="text-gray-500">Name:</span>{' '}
              {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—'}
            </p>
            <p>
              <span className="text-gray-500">Email:</span> {customer.email}
            </p>
          </div>
        )}
      </div>

      {/* Marketing preferences */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Marketing emails</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Occasional promotions and product news. You can unsubscribe anytime.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={marketingOptIn}
            disabled={optInMut.isPending}
            onClick={() => optInMut.mutate({ marketingOptIn: !marketingOptIn })}
            className="shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
            style={{ background: marketingOptIn ? 'var(--primary)' : '#d1d5db' }}
          >
            <span
              className="block w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: marketingOptIn ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>

      <SubscriptionsSection />

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          to="/account/addresses"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-[var(--primary)] transition-colors"
        >
          <p className="font-semibold text-sm">📦 Address book</p>
          <p className="text-xs text-gray-500 mt-1">Manage your saved addresses</p>
        </Link>
      </div>

      {/* Loyalty */}
      <LoyaltySection />

      {/* Orders */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-lg mb-4">Order history</h2>
        {ordersQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !ordersQuery.data?.length ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ordersQuery.data.map((order) => (
              <div key={order.id} className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">#{order.number}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fmt(order.totalAmount, order.currency)}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'fulfilled'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
                {(order.status === 'paid' || order.status === 'fulfilled') && (
                  <OrderDownloads orderId={order.id} />
                )}
                {(order.status === 'paid' ||
                  order.status === 'fulfilled' ||
                  order.status === 'refunded') && (
                  <ReturnRequestSection
                    orderId={order.id}
                    canRequest={order.status !== 'refunded'}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* GDPR / Privacy */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-1">Privacy &amp; data</h2>
        <p className="text-sm text-gray-500 mb-5">
          Your rights under GDPR — export or permanently delete your personal data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportQuery.isFetching}
            className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {exportQuery.isFetching ? 'Preparing…' : '⬇ Export my data (JSON)'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirm('')
              setShowDeleteModal(true)
            }}
            className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
          >
            🗑 Delete my account
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete your account?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently anonymise all your personal data. Your order history will be
              retained for legal/accounting purposes but will no longer be linked to you.
              <br />
              <br />
              <strong>This action cannot be undone.</strong> Type{' '}
              <code className="bg-gray-100 px-1 rounded">DELETE</code> to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 font-mono"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => deleteAccountMut.mutate()}
                disabled={deleteConfirm !== 'DELETE' || deleteAccountMut.isPending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-red-700"
              >
                {deleteAccountMut.isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
            {deleteAccountMut.error && (
              <p className="mt-3 text-sm text-red-600">{deleteAccountMut.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const INTERVAL_LABEL: Record<'weekly' | 'monthly' | 'yearly', string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

function SubscriptionsSection() {
  const utils = trpc.useUtils()
  const { data: subs = [], isLoading } = trpc.subscriptions.list.useQuery()

  const pauseMut = trpc.subscriptions.pause.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })
  const resumeMut = trpc.subscriptions.resume.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })
  const cancelMut = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })

  if (isLoading || subs.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="font-semibold text-lg mb-1">Subscriptions</h2>
      <p className="text-sm text-gray-500 mb-4">
        We'll email you a reminder to reorder — no auto-charge.
      </p>
      <div className="space-y-3">
        {subs.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {s.quantity} × {s.productName}
                {s.variantName && <span className="text-gray-400"> — {s.variantName}</span>}
              </p>
              <p className="text-xs text-gray-400">
                {INTERVAL_LABEL[s.interval]} · {fmt(s.priceAmount, s.priceCurrency)} · next reminder{' '}
                {new Date(s.nextRenewalAt).toLocaleDateString()}
                {s.status !== 'active' && ` · ${s.status}`}
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              {s.status === 'active' && (
                <button
                  type="button"
                  onClick={() => pauseMut.mutate({ id: s.id })}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Pause
                </button>
              )}
              {s.status === 'paused' && (
                <button
                  type="button"
                  onClick={() => resumeMut.mutate({ id: s.id })}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Resume
                </button>
              )}
              {s.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Cancel this subscription?')) cancelMut.mutate({ id: s.id })
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoyaltySection() {
  const { data, isLoading } = trpc.loyalty.myAccount.useQuery()
  if (isLoading || !data || !data.enabled) return null

  const fmtPts = (n: number) => `${n} pt${n !== 1 ? 's' : ''}`
  const euroValue = (pts: number) =>
    ((pts * data.redeemRate) / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Loyalty points</h2>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            {fmtPts(data.balance)}
          </p>
          {data.balance > 0 && (
            <p className="text-xs text-gray-400">&asymp; {euroValue(data.balance)}</p>
          )}
        </div>
      </div>
      {data.transactions.length === 0 ? (
        <p className="text-sm text-gray-400">
          Earn {data.earnRate} point{data.earnRate !== 1 ? 's' : ''} per €1 spent. Redeem at
          checkout.
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="py-2 flex items-center justify-between">
              <p className="text-sm text-gray-600">{tx.description}</p>
              <span
                className={`text-sm font-semibold ${tx.points >= 0 ? 'text-green-600' : 'text-red-500'}`}
              >
                {tx.points > 0 ? '+' : ''}
                {tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const RETURN_STATUS_LABEL: Record<string, string> = {
  pending: 'Return requested — awaiting review',
  approved: 'Return approved — refund issued',
  rejected: 'Return request rejected',
}

const RETURN_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function ReturnRequestSection({
  orderId,
  canRequest,
}: {
  orderId: string
  canRequest: boolean
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const utils = trpc.useUtils()

  const { data: requests = [], isLoading } = trpc.returns.myRequests.useQuery()
  const existing = requests.find((r) => r.orderId === orderId)

  const createMut = trpc.returns.create.useMutation({
    onSuccess() {
      setOpen(false)
      setReason('')
      utils.returns.myRequests.invalidate()
    },
  })

  if (isLoading) return null

  if (existing) {
    return (
      <div className="mt-3">
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${RETURN_STATUS_STYLE[existing.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {RETURN_STATUS_LABEL[existing.status] ?? existing.status}
        </span>
      </div>
    )
  }

  if (!canRequest) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-[var(--primary)] hover:underline"
      >
        ↩ Request a return
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createMut.mutate({ orderId, reason })
      }}
      className="mt-3 space-y-2"
    >
      <label htmlFor={`return-reason-${orderId}`} className="block text-xs text-gray-500">
        Tell us why you'd like to return this order (at least 10 characters)
      </label>
      <textarea
        id={`return-reason-${orderId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        minLength={10}
        maxLength={1000}
        required
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder="E.g. the item arrived damaged, wrong size, changed my mind…"
      />
      {createMut.error && <p className="text-xs text-red-600">{createMut.error.message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={reason.trim().length < 10 || createMut.isPending}
          className="bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {createMut.isPending ? 'Submitting…' : 'Submit return request'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
          className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function OrderDownloads({ orderId }: { orderId: string }) {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

  const { data: tokens = [] } = trpc.downloads.forOrder.useQuery({ orderId })
  if (tokens.length === 0) return null

  return (
    <div className="mt-3 space-y-1.5">
      {tokens.map((t) => {
        const expired = t.downloadCount >= t.maxDownloads || new Date(t.expiresAt) < new Date()
        return (
          <div key={t.id} className="flex items-center gap-2">
            {expired ? (
              <span className="text-xs text-gray-400 line-through">
                ⬇ {t.productDownload.filename} (expired)
              </span>
            ) : (
              <a
                href={`${apiBase}/download/${t.token}`}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                ⬇ {t.productDownload.filename}
                <span className="text-gray-400">({t.maxDownloads - t.downloadCount} left)</span>
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
