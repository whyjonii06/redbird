import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMeta } from '../App.js'
import { useAuth } from '../AuthContext.js'
import { useCartContext, useCartData } from '../CartContext.js'
import { fmt, trpc } from '../trpc.js'

export function CartPage() {
  const meta = useMeta()
  const navigate = useNavigate()
  const { customer } = useAuth()
  const { cartId } = useCartContext()
  const { data: cart, refetch } = useCartData()
  const utils = trpc.useUtils()
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteNote, setQuoteNote] = useState('')

  const requestQuoteMut = trpc.quotes.create.useMutation({
    onSuccess: () => navigate('/account'),
  })

  const removeItem = trpc.cart.removeItem.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  })
  const updateQty = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  })

  if (!cartId || !cart || cart.lineItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-6">🛒</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Add something to get started.</p>
        <Link
          to="/products"
          className="inline-block px-8 py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Browse products
        </Link>
      </div>
    )
  }

  const subtotal = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)
  const currency = cart.currency

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your cart</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {cart.lineItems.map((li, i) => (
          <div
            key={li.id}
            className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {li.productName}
                {li.variantName ? ` — ${li.variantName}` : ''}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {fmt(li.unitPriceAmount, li.unitPriceCurrency)} each
              </p>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  li.quantity > 1
                    ? updateQty.mutate({
                        cartId: cartId!,
                        lineItemId: li.id,
                        quantity: li.quantity - 1,
                      })
                    : removeItem.mutate({ cartId: cartId!, lineItemId: li.id })
                }
                className="w-7 h-7 rounded-lg border border-gray-200 text-sm flex items-center justify-center hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{li.quantity}</span>
              <button
                type="button"
                onClick={() =>
                  updateQty.mutate({
                    cartId: cartId!,
                    lineItemId: li.id,
                    quantity: li.quantity + 1,
                  })
                }
                className="w-7 h-7 rounded-lg border border-gray-200 text-sm flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
            </div>

            <p className="font-semibold text-gray-900 text-sm w-20 text-right">
              {fmt(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
            </p>

            <button
              type="button"
              onClick={() => removeItem.mutate({ cartId: cartId!, lineItemId: li.id })}
              className="text-gray-300 hover:text-red-400 transition-colors ml-2"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between mb-6">
        <p className="font-semibold text-gray-700">Subtotal</p>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">{fmt(subtotal, currency)}</p>
          {meta.priceDisplay !== 'none' && (
            <p className="text-xs text-gray-400 mt-0.5">
              {meta.priceDisplay === 'incl_tax' ? 'Tax incl.' : 'Excl. tax'}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          to="/products"
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ← Continue shopping
        </Link>
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Proceed to checkout →
        </button>
      </div>

      {customer && (
        <div className="mt-6 border-t border-gray-100 pt-6">
          {!showQuoteForm ? (
            <button
              type="button"
              onClick={() => setShowQuoteForm(true)}
              className="text-sm text-gray-500 hover:text-[var(--primary)] hover:underline"
            >
              Buying in bulk? Request a custom quote for this cart →
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                requestQuoteMut.mutate({
                  currency,
                  items: cart.lineItems.map((li) => ({
                    variantId: li.variantId,
                    quantity: li.quantity,
                  })),
                  ...(quoteNote.trim() ? { customerNote: quoteNote.trim() } : {}),
                })
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <p className="text-sm font-medium text-gray-700">Request a custom quote</p>
              <textarea
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                rows={3}
                placeholder="Tell us about your order — quantities, timeline, anything relevant…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              {requestQuoteMut.error && (
                <p className="text-xs text-red-600">{requestQuoteMut.error.message}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={requestQuoteMut.isPending}
                  className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {requestQuoteMut.isPending ? 'Submitting…' : 'Submit request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuoteForm(false)}
                  className="text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
