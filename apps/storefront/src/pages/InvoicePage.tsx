import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMeta } from '../App.js'
import { fmt, trpc } from '../trpc.js'

export function InvoicePage() {
  const { number } = useParams<{ number: string }>()
  const meta = useMeta()
  const { data: order, isLoading, error } = trpc.checkout.getByNumber.useQuery({ number: number! })

  useEffect(() => {
    if (order) document.title = `Invoice #${order.number} — ${meta.storeName}`
    return () => {
      document.title = meta.storeName
    }
  }, [order, meta.storeName])

  if (isLoading) return <div className="p-12 text-center text-gray-400">Loading…</div>
  if (error || !order) return <div className="p-12 text-center text-gray-500">Order not found.</div>

  const addr = order.shippingAddress as {
    firstName: string
    lastName: string
    line1: string
    line2?: string
    city: string
    postalCode: string
    countryCode: string
    phone?: string
  } | null

  return (
    <div className="max-w-2xl mx-auto px-8 py-12 print:px-0 print:py-0">
      {/* Actions — hidden when printing */}
      <div className="flex justify-end gap-3 mb-6 print:hidden">
        <a
          href={`${(import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'}/invoices/${order.id}.pdf`}
          download={`invoice-${order.number}.pdf`}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2 rounded-lg text-sm font-medium"
        >
          Download PDF
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-[var(--primary)] text-white px-5 py-2 rounded-lg text-sm font-medium"
        >
          Print
        </button>
      </div>

      {/* Invoice */}
      <div className="border border-gray-200 rounded-2xl p-10 print:border-none print:rounded-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{meta.storeName}</h1>
            {meta.branding.contactEmail && (
              <p className="text-sm text-gray-500 mt-1">{meta.branding.contactEmail}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">INVOICE</p>
            <p className="text-sm text-gray-500 mt-1">#{order.number}</p>
            <p className="text-sm text-gray-500">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Bill to */}
        {(order.customerEmail || addr) && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase text-gray-400 mb-2">Bill to</p>
            {addr && (
              <p className="text-sm font-medium text-gray-900">
                {addr.firstName} {addr.lastName}
              </p>
            )}
            {order.customerEmail && <p className="text-sm text-gray-600">{order.customerEmail}</p>}
            {addr && (
              <div className="text-sm text-gray-600 mt-1">
                <p>{addr.line1}</p>
                {addr.line2 && <p>{addr.line2}</p>}
                <p>
                  {addr.postalCode} {addr.city}
                </p>
                <p>{addr.countryCode}</p>
                {addr.phone && <p>{addr.phone}</p>}
              </div>
            )}
          </div>
        )}

        {/* Line items */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Item</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                Unit price
              </th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-100">
                <td className="py-3 text-gray-700">
                  {li.productName} — {li.variantName}{' '}
                  <span className="text-gray-400 text-xs">({li.sku})</span>
                </td>
                <td className="py-3 text-right text-gray-700">{li.quantity}</td>
                <td className="py-3 text-right text-gray-700">
                  {fmt(li.unitPriceAmount, li.unitPriceCurrency)}
                </td>
                <td className="py-3 text-right font-medium text-gray-900">
                  {fmt(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            {order.subtotalAmount !== order.totalAmount && (
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{fmt(order.subtotalAmount, order.currency)}</span>
              </div>
            )}
            {(order.shippingAmount ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{fmt(order.shippingAmount!, order.currency)}</span>
              </div>
            )}
            {(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                <span>−{fmt(order.discountAmount!, order.currency)}</span>
              </div>
            )}
            {(order.taxAmount ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{fmt(order.taxAmount!, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{fmt(order.totalAmount, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-10 pt-6 border-t border-gray-100">
          <span
            className={`text-xs font-semibold uppercase px-3 py-1 rounded-full ${
              order.status === 'paid' || order.status === 'fulfilled'
                ? 'bg-green-100 text-green-700'
                : order.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>
    </div>
  )
}
