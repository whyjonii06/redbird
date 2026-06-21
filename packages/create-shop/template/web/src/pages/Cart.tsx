import { Link } from 'react-router-dom'
import { getCartId } from '../cart'
import { fmt, trpc } from '../trpc'

export function Cart() {
  const cartId = getCartId()
  const { data: cart, isLoading } = trpc.cart.get.useQuery(
    { cartId: cartId! },
    { enabled: !!cartId },
  )

  if (!cartId || (!isLoading && (!cart || cart.lineItems.length === 0))) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link to="/" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
          Browse products
        </Link>
      </div>
    )
  }

  if (isLoading || !cart) return <p className="text-gray-400">Loading…</p>

  const total = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Cart</h1>
      <div className="divide-y divide-gray-100 border-y border-gray-100">
        {cart.lineItems.map((li) => (
          <div key={li.id} className="flex justify-between py-3">
            <span>
              {li.quantity} × {fmt(li.unitPriceAmount, li.unitPriceCurrency)}
            </span>
            <span className="font-medium">
              {fmt(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4 text-lg font-bold">
        <span>Total</span>
        <span>{fmt(total, cart.currency)}</span>
      </div>
      <p className="text-xs text-gray-400 mt-6">
        Wire up checkout with <code>trpc.checkout.*</code> — you own this code.
      </p>
    </div>
  )
}
