import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge.js'
import {
  btnBlue,
  btnDangerOutline,
  btnOrange,
  btnOrangeOutline,
  btnPrimary,
  btnSecondary,
  btnSuccess,
} from '../components/ui.js'
import { fmt, fmtDate, trpc } from '../trpc.js'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const utils = trpc.useUtils()
  const { data: order, isLoading, error } = trpc.admin.orders.byId.useQuery({ id: id! })

  const markPaid = trpc.admin.orders.markPaid.useMutation({
    onSuccess: () => utils.admin.orders.byId.invalidate(),
  })
  const markFulfilled = trpc.admin.orders.markFulfilled.useMutation({
    onSuccess: () => utils.admin.orders.byId.invalidate(),
  })
  const cancel = trpc.admin.orders.cancel.useMutation({
    onSuccess: () => utils.admin.orders.byId.invalidate(),
  })
  const refund = trpc.admin.orders.refund.useMutation({
    onSuccess: () => utils.admin.orders.byId.invalidate(),
  })
  const refundPartial = trpc.admin.orders.refundPartial.useMutation({
    onSuccess: () => {
      void utils.admin.orders.byId.invalidate()
      setPartialRefundOpen(false)
      setPartialRefundAmount('')
    },
  })

  const [partialRefundOpen, setPartialRefundOpen] = useState(false)
  const [partialRefundAmount, setPartialRefundAmount] = useState('')

  const busy = markPaid.isPending || markFulfilled.isPending || cancel.isPending || refund.isPending

  if (isLoading)
    return (
      <Shell>
        <p className="text-gray-400 text-sm">Loading…</p>
      </Shell>
    )
  if (error)
    return (
      <Shell>
        <p className="text-red-500 text-sm">{error.message}</p>
      </Shell>
    )
  if (!order) return null

  const actions: Array<{ label: string; fn: () => void; style: string; show: boolean }> = [
    {
      label: 'Mark paid',
      fn: () => markPaid.mutate({ id: order.id }),
      style: btnBlue,
      show: order.status === 'pending',
    },
    {
      label: 'Mark fulfilled',
      fn: () => markFulfilled.mutate({ id: order.id }),
      style: btnSuccess,
      show: order.status === 'paid',
    },
    {
      label: 'Cancel',
      fn: () => {
        if (confirm('Cancel this order?')) cancel.mutate({ id: order.id })
      },
      style: btnDangerOutline,
      show: order.status === 'pending' || order.status === 'paid',
    },
    {
      label: 'Refund',
      fn: () => {
        if (confirm('Refund this order in full?')) refund.mutate({ id: order.id })
      },
      style: btnSecondary,
      show: order.status === 'paid' || order.status === 'fulfilled',
    },
    {
      label: 'Partial refund',
      fn: () => setPartialRefundOpen((v) => !v),
      style: btnOrangeOutline,
      show: order.status === 'paid' || order.status === 'fulfilled',
    },
  ]

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-gray-900">{order.number}</h1>
            <Badge value={order.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {order.customerEmail} · {fmtDate(order.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/invoices/${order.id}.pdf`}
            download={`invoice-${order.number}.pdf`}
            className={btnSecondary}
          >
            Invoice PDF
          </a>
          {actions
            .filter((a) => a.show)
            .map((a) => (
              <button
                type="button"
                key={a.label}
                onClick={a.fn}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${a.style}`}
              >
                {a.label}
              </button>
            ))}
        </div>
      </div>

      {/* Purchase order banner */}
      {order.poNumber && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-5 py-3.5 flex items-center justify-between">
          <div className="text-sm text-indigo-900">
            <span className="font-semibold">Purchase order</span> · PO #{order.poNumber}
            {order.dueDate && <> · Due {fmtDate(order.dueDate)}</>}
          </div>
          {order.status === 'pending' && (
            <span className="text-xs text-indigo-600">
              Awaiting bank transfer — not a card charge
            </span>
          )}
        </div>
      )}

      {/* Partial refund panel */}
      {partialRefundOpen && (
        <div className="bg-orange-50 border border-orange-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Partial refund</h3>
            <button
              type="button"
              onClick={() => setPartialRefundOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Total: {fmt(order.totalAmount, order.currency)}
            {order.refundedAmount > 0 && (
              <> · Already refunded: {fmt(order.refundedAmount, order.currency)}</>
            )}{' '}
            · Remaining: {fmt(order.totalAmount - order.refundedAmount, order.currency)}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const cents = Math.round(Number.parseFloat(partialRefundAmount) * 100)
              if (!Number.isNaN(cents) && cents > 0) {
                refundPartial.mutate({ id: order.id, amount: cents })
              }
            }}
            className="flex gap-3 items-end"
          >
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Amount ({order.currency})</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={((order.totalAmount - order.refundedAmount) / 100).toFixed(2)}
                value={partialRefundAmount}
                onChange={(e) => setPartialRefundAmount(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <button
              type="submit"
              disabled={refundPartial.isPending || !partialRefundAmount}
              className={btnOrange}
            >
              {refundPartial.isPending ? 'Processing…' : 'Apply refund'}
            </button>
          </form>
          {refundPartial.error && (
            <p className="text-xs text-red-600">{refundPartial.error.message}</p>
          )}
        </div>
      )}

      {/* Line items */}
      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">
                Product
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">
                SKU
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">
                Unit price
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">
                Qty
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-50">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-gray-900">{li.productName}</p>
                  <p className="text-gray-500">{li.variantName}</p>
                </td>
                <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{li.sku}</td>
                <td className="px-5 py-3.5 text-right text-gray-700">
                  {fmt(li.unitPriceAmount, li.unitPriceCurrency)}
                </td>
                <td className="px-5 py-3.5 text-right text-gray-700">{li.quantity}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                  {fmt(li.totalAmount, li.unitPriceCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-5 py-3 text-sm text-gray-500 text-right">
                Subtotal
              </td>
              <td className="px-5 py-3 text-right font-medium text-gray-700">
                {fmt(order.subtotalAmount, order.currency)}
              </td>
            </tr>
            {order.shippingAmount > 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-sm text-gray-500 text-right">
                  Shipping
                </td>
                <td className="px-5 py-2 text-right font-medium text-gray-700">
                  {fmt(order.shippingAmount, order.currency)}
                </td>
              </tr>
            )}
            {order.taxAmount > 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-sm text-gray-500 text-right">
                  Tax
                </td>
                <td className="px-5 py-2 text-right font-medium text-gray-700">
                  {fmt(order.taxAmount, order.currency)}
                </td>
              </tr>
            )}
            <tr className="border-t border-gray-200">
              <td
                colSpan={4}
                className="px-5 py-3.5 text-sm font-semibold text-gray-900 text-right"
              >
                Total
              </td>
              <td className="px-5 py-3.5 text-right text-base font-bold text-gray-900">
                {fmt(order.totalAmount, order.currency)}
              </td>
            </tr>
            {order.refundedAmount > 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-sm text-orange-600 text-right">
                  Refunded
                </td>
                <td className="px-5 py-2 text-right font-medium text-orange-600">
                  −{fmt(order.refundedAmount, order.currency)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {order.shippingAddress && (
        <div className="bg-gray-50 border border-gray-200 p-4 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Shipping address</p>
          <p className="text-gray-800">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          <p className="text-gray-600">{order.shippingAddress.line1}</p>
          {order.shippingAddress.line2 && (
            <p className="text-gray-600">{order.shippingAddress.line2}</p>
          )}
          <p className="text-gray-600">
            {order.shippingAddress.postalCode} {order.shippingAddress.city}
          </p>
          <p className="text-gray-600 uppercase">{order.shippingAddress.countryCode}</p>
          {order.shippingAddress.phone && (
            <p className="text-gray-500 mt-1">{order.shippingAddress.phone}</p>
          )}
        </div>
      )}

      <TrackingSection
        orderId={order.id}
        trackingNumber={order.trackingNumber}
        trackingUrl={order.trackingUrl}
      />
      <NotesSection orderId={order.id} notes={order.notes} />
    </Shell>
  )
}

function TrackingSection({
  orderId,
  trackingNumber,
  trackingUrl,
}: { orderId: string; trackingNumber: string | null; trackingUrl: string | null }) {
  const utils = trpc.useUtils()
  const [num, setNum] = useState(trackingNumber ?? '')
  const [url, setUrl] = useState(trackingUrl ?? '')
  const setTracking = trpc.admin.orders.setTracking.useMutation({
    onSuccess: () => void utils.admin.orders.byId.invalidate({ id: orderId }),
  })

  return (
    <div className="bg-gray-100 border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Shipping & Tracking</h3>
      {trackingNumber && (
        <p className="text-sm text-gray-700">
          Tracking: <span className="font-mono font-medium">{trackingNumber}</span>
          {trackingUrl && (
            <>
              {' '}
              ·{' '}
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline text-xs"
              >
                Track package
              </a>
            </>
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (num.trim())
            setTracking.mutate({
              id: orderId,
              trackingNumber: num.trim(),
              trackingUrl: url.trim() || undefined,
            })
        }}
        className="flex gap-2 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Tracking number</label>
          <input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="1Z999AA10123456784"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Tracking URL (optional)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://track.example.com/…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!num.trim() || setTracking.isPending}
          className={btnPrimary}
        >
          Save
        </button>
      </form>
    </div>
  )
}

function NotesSection({ orderId, notes }: { orderId: string; notes: string | null }) {
  const utils = trpc.useUtils()
  const [text, setText] = useState('')
  const addNote = trpc.admin.orderNotes.add.useMutation({
    onSuccess: () => {
      void utils.admin.orders.byId.invalidate({ id: orderId })
      setText('')
    },
  })

  return (
    <div className="bg-gray-100 border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Internal notes</h3>
      {notes ? (
        <div className="space-y-1">
          {notes.split('\n').map((line, i) => (
            <p key={i} className="text-sm text-gray-700 font-mono">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No notes yet.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) addNote.mutate({ orderId, note: text.trim() })
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" disabled={!text.trim() || addNote.isPending} className={btnPrimary}>
          Add
        </button>
      </form>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 space-y-6">
      <Link to="/orders" className="text-sm text-indigo-600 hover:underline">
        ← Back to orders
      </Link>
      {children}
    </div>
  )
}
