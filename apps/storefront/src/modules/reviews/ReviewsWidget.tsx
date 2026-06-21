import { useState } from 'react'
import { useAuth } from '../../AuthContext.js'
import { trpc } from '../../trpc.js'

function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          aria-hidden="true"
          key={s}
          className={`w-4 h-4 ${s <= Math.round(value) ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

/**
 * Reviews storefront widget — mounted into the `product.tab` slot.
 * Owned by the reviews module; the product page knows nothing about it.
 */
export function ReviewsWidget({ productId }: { productId: string }) {
  const { customer } = useAuth()
  const { data: reviews = [] } = trpc.reviews.list.useQuery({ productId })
  const { data: stats } = trpc.reviews.stats.useQuery({ productId })
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [name, setName] = useState(
    customer ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() : '',
  )
  const [submitted, setSubmitted] = useState(false)

  const createMut = trpc.reviews.create.useMutation({
    onSuccess() {
      setSubmitted(true)
      setShowForm(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMut.mutate({
      productId,
      rating,
      comment: comment || undefined,
      customerName: name || 'Anonymous',
    })
  }

  return (
    <div className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer reviews</h2>
          {stats && stats.count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={stats.average} />
              <span className="text-sm text-gray-500">
                {stats.average.toFixed(1)} · {stats.count} review{stats.count !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        {!showForm && !submitted && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg"
          >
            Write a review
          </button>
        )}
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-700">
          Thank you! Your review will appear after moderation.
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 space-y-4"
        >
          <h3 className="font-semibold text-gray-900">Your review</h3>
          <div>
            <label htmlFor="f-2" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="f-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`${s} star${s > 1 ? 's' : ''}`}
                  onClick={() => setRating(s)}
                >
                  <svg
                    aria-hidden="true"
                    className={`w-7 h-7 ${s <= rating ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-400 transition-colors`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="f-3" className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              id="f-3"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {createMut.isPending ? 'Submitting…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-500">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-6">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-gray-100 pb-6 last:border-0">
              <div className="flex items-center gap-3 mb-2">
                <StarRating value={r.rating} />
                <span className="font-semibold text-sm text-gray-900">{r.customerName}</span>
                <span className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
