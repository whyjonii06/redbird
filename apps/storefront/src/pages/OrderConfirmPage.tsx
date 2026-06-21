import { Link, useParams } from 'react-router-dom'
import { fmt, trpc } from '../trpc.js'

export function OrderConfirmPage() {
  const { number } = useParams<{ number: string }>()
  const { data: order, isLoading } = trpc.checkout.getByNumber.useQuery({ number: number! })

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500">Order not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        ✓
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Order confirmed!</h1>
      <p className="text-gray-500 mb-1">Thank you for your purchase.</p>
      <p className="text-sm text-gray-400 mb-8">
        Order number: <span className="font-mono font-semibold text-gray-700">{order.number}</span>
      </p>

      {/* Order details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-left mb-8">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Items ordered
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {order.lineItems.map((li) => (
            <div key={li.id} className="px-5 py-3.5 flex justify-between items-center text-sm">
              <div>
                <p className="font-semibold text-gray-900">{li.productName}</p>
                <p className="text-gray-500">
                  {li.variantName} × {li.quantity}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                {fmt(li.totalAmount, li.unitPriceCurrency)}
              </p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3.5 border-t border-gray-100 flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{fmt(order.totalAmount, order.currency)}</span>
        </div>
      </div>

      {order.shippingAddress && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-left mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Shipping to
          </p>
          <p className="text-gray-800">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          <p className="text-gray-600">{order.shippingAddress.line1}</p>
          {order.shippingAddress.line2 && (
            <p className="text-gray-600">{order.shippingAddress.line2}</p>
          )}
          <p className="text-gray-600">
            {order.shippingAddress.postalCode} {order.shippingAddress.city},{' '}
            {order.shippingAddress.countryCode}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 flex-wrap">
        <Link
          to={`/invoice/${order.number}`}
          className="inline-block px-6 py-3 rounded-xl font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View invoice
        </Link>
        <Link
          to="/products"
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
