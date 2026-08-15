import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMeta } from '../App.js'
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

      {/* Saved payment methods */}
      <PaymentMethodsSection />

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
  const { data: paymentMethods = [] } = trpc.paymentMethods.list.useQuery()

  const pauseMut = trpc.subscriptions.pause.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })
  const resumeMut = trpc.subscriptions.resume.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })
  const cancelMut = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })
  const setPaymentMethodMut = trpc.subscriptions.setPaymentMethod.useMutation({
    onSuccess: () => void utils.subscriptions.list.invalidate(),
  })

  if (isLoading || subs.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="font-semibold text-lg mb-1">Subscriptions</h2>
      <p className="text-sm text-gray-500 mb-4">
        Auto-charges a saved card each cycle when one's attached, otherwise we email a reminder.
      </p>
      <div className="space-y-3">
        {subs.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {s.quantity} × {s.productName}
                {s.variantName && <span className="text-gray-400"> — {s.variantName}</span>}
              </p>
              <p className="text-xs text-gray-400">
                {INTERVAL_LABEL[s.interval]} · {fmt(s.priceAmount, s.priceCurrency)} · next{' '}
                {s.paymentMethodId ? 'charge' : 'reminder'}{' '}
                {new Date(s.nextRenewalAt).toLocaleDateString()}
                {s.status !== 'active' && ` · ${s.status}`}
              </p>
              {paymentMethods.length > 0 && (
                <select
                  value={s.paymentMethodId ?? ''}
                  onChange={(e) =>
                    setPaymentMethodMut.mutate({
                      id: s.id,
                      paymentMethodId: e.target.value || null,
                    })
                  }
                  className="mt-1.5 text-xs border border-gray-200 rounded px-2 py-1"
                >
                  <option value="">Reminder email only</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      Auto-charge {pm.brand ?? 'card'} •••• {pm.last4}
                    </option>
                  ))}
                </select>
              )}
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

const CARD_BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  declined: 'Test (declines)',
}

function PaymentMethodsSection() {
  const [adding, setAdding] = useState(false)
  const utils = trpc.useUtils()
  const { data: methods = [], isLoading } = trpc.paymentMethods.list.useQuery()

  const setDefaultMut = trpc.paymentMethods.setDefault.useMutation({
    onSuccess: () => utils.paymentMethods.list.invalidate(),
  })
  const removeMut = trpc.paymentMethods.remove.useMutation({
    onSuccess: () => utils.paymentMethods.list.invalidate(),
  })

  if (isLoading) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Payment methods</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            + Add a card
          </button>
        )}
      </div>

      {methods.length === 0 && !adding && (
        <p className="text-sm text-gray-400">
          No saved payment methods. Add one to enable subscriptions and one-click reorder.
        </p>
      )}

      {methods.length > 0 && (
        <div className="divide-y divide-gray-100 mb-2">
          {methods.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-gray-100 rounded px-2 py-1">
                  {CARD_BRAND_LABEL[m.brand ?? ''] ?? m.brand ?? 'Card'}
                </span>
                <span className="text-sm text-gray-700">
                  &bull;&bull;&bull;&bull; {m.last4 ?? '----'}
                </span>
                {m.expMonth && m.expYear && (
                  <span className="text-xs text-gray-400">
                    exp {String(m.expMonth).padStart(2, '0')}/{m.expYear}
                  </span>
                )}
                {m.isDefault && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!m.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultMut.mutate({ id: m.id })}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Set default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeMut.mutate({ id: m.id })}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddPaymentMethodForm onDone={() => setAdding(false)} />}
    </div>
  )
}

function AddPaymentMethodForm({ onDone }: { onDone: () => void }) {
  const meta = useMeta()
  const utils = trpc.useUtils()
  const [setupIntent, setSetupIntent] = useState<{
    clientSecret: string
    customerRef: string
    provider: string
  } | null>(null)
  const [error, setError] = useState('')

  const createMut = trpc.paymentMethods.createSetupIntent.useMutation({
    onSuccess: (data) => setSetupIntent(data),
    onError: (err) => setError(err.message),
  })

  const attachMut = trpc.paymentMethods.attach.useMutation({
    onSuccess: () => {
      utils.paymentMethods.list.invalidate()
      onDone()
    },
    onError: (err) => setError(err.message),
  })

  const stripePromise = useMemo(
    () => (meta.stripePublicKey ? loadStripe(meta.stripePublicKey) : null),
    [meta.stripePublicKey],
  )

  if (!setupIntent) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => createMut.mutate(undefined)}
            disabled={createMut.isPending}
            className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {createMut.isPending ? 'Starting…' : 'Continue'}
          </button>
          <button type="button" onClick={onDone} className="text-sm text-gray-500">
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  const isDemo = setupIntent.clientSecret.endsWith('_secret_demo')

  function attach(paymentMethodId: string) {
    attachMut.mutate({
      provider: setupIntent!.provider,
      providerCustomerId: setupIntent!.customerRef,
      providerPaymentMethodId: paymentMethodId,
    })
  }

  if (isDemo) {
    return (
      <DemoCardPicker
        onPick={attach}
        onCancel={onDone}
        pending={attachMut.isPending}
        error={error}
      />
    )
  }

  if (!stripePromise) {
    return <p className="text-sm text-red-600">Card entry is not configured for this store.</p>
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: setupIntent.clientSecret, appearance: { theme: 'stripe' } }}
    >
      <StripeSetupForm
        onAttach={attach}
        onCancel={onDone}
        pending={attachMut.isPending}
        error={error}
      />
    </Elements>
  )
}

function StripeSetupForm({
  onAttach,
  onCancel,
  pending,
  error,
}: {
  onAttach: (paymentMethodId: string) => void
  onCancel: () => void
  pending: boolean
  error: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [localError, setLocalError] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLocalError('')
    setConfirming(true)
    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/account` },
      redirect: 'if_required',
    })
    setConfirming(false)
    if (stripeError) {
      setLocalError(stripeError.message ?? 'Could not save card')
      return
    }
    const pm = setupIntent?.payment_method
    if (pm) onAttach(typeof pm === 'string' ? pm : pm.id)
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="border border-gray-200 rounded-lg p-4 space-y-4"
    >
      <PaymentElement />
      {(localError || error) && <p className="text-xs text-red-600">{localError || error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || confirming || pending}
          className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {confirming || pending ? 'Saving…' : 'Save card'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  )
}

// Base ids — a random suffix is appended on pick so each attach gets a
// globally-unique id, same as a real Stripe payment method id would be
// (the DB enforces uniqueness per provider+payment-method-id).
const DEMO_CARDS = [
  { label: 'Visa •••• 4242', id: 'pm_demo_visa_4242' },
  { label: 'Mastercard •••• 5555', id: 'pm_demo_mastercard_5555' },
  { label: 'Test card that always declines •••• 0002', id: 'pm_demo_declined_0002' },
]

function DemoCardPicker({
  onPick,
  onCancel,
  pending,
  error,
}: {
  onPick: (paymentMethodId: string) => void
  onCancel: () => void
  pending: boolean
  error: string
}) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
      <p className="text-xs text-amber-600 font-medium">
        Demo mode — no live payment provider configured. Pick a simulated card.
      </p>
      <div className="flex flex-col gap-2">
        {DEMO_CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(`${c.id}_${crypto.randomUUID().slice(0, 8)}`)}
            className="text-left text-sm border border-gray-200 rounded-lg px-3 py-2 hover:border-[var(--primary)] disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="button" onClick={onCancel} className="text-sm text-gray-500">
        Cancel
      </button>
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
  const [selected, setSelected] = useState<Record<string, number>>({})
  const utils = trpc.useUtils()

  const { data: requests = [], isLoading } = trpc.returns.myRequests.useQuery()
  const existing = requests.find((r) => r.orderId === orderId)

  const { data: eligibleItems = [] } = trpc.returns.eligibleItems.useQuery(
    { orderId },
    { enabled: open },
  )

  const createMut = trpc.returns.create.useMutation({
    onSuccess() {
      setOpen(false)
      setReason('')
      setSelected({})
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

  const items = Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([lineItemId, quantity]) => ({ lineItemId, quantity }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createMut.mutate({ orderId, reason, items })
      }}
      className="mt-3 space-y-3"
    >
      {eligibleItems.length === 0 ? (
        <p className="text-xs text-gray-500">Every item on this order has already been returned.</p>
      ) : (
        <div className="space-y-2">
          <p className="block text-xs text-gray-500">What would you like to return?</p>
          {eligibleItems.map((item) => {
            const qty = selected[item.lineItemId] ?? 0
            return (
              <div
                key={item.lineItemId}
                className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {item.productName}
                    {item.variantName && (
                      <span className="text-gray-400"> — {item.variantName}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmt(item.unitPriceAmount, item.unitPriceCurrency)} · up to{' '}
                    {item.returnableQuantity} unit{item.returnableQuantity === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((s) => ({ ...s, [item.lineItemId]: Math.max(0, qty - 1) }))
                    }
                    className="w-6 h-6 rounded border border-gray-300 text-sm"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm">{qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((s) => ({
                        ...s,
                        [item.lineItemId]: Math.min(item.returnableQuantity, qty + 1),
                      }))
                    }
                    className="w-6 h-6 rounded border border-gray-300 text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <label htmlFor={`return-reason-${orderId}`} className="block text-xs text-gray-500">
        Tell us why you'd like to return these items (at least 10 characters)
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
          disabled={reason.trim().length < 10 || items.length === 0 || createMut.isPending}
          className="bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {createMut.isPending ? 'Submitting…' : 'Submit return request'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setReason('')
            setSelected({})
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
