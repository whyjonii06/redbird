import { Link } from 'react-router-dom'
import { btnLinkDanger } from '../components/ui.js'
import { trpc } from '../trpc.js'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          aria-hidden="true"
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

export function ReviewsPage() {
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.reviews.list.useQuery({})

  const approveMut = trpc.admin.reviews.approve.useMutation({
    onSuccess: () => utils.admin.reviews.list.invalidate(),
  })
  const deleteMut = trpc.admin.reviews.delete.useMutation({
    onSuccess: () => utils.admin.reviews.list.invalidate(),
  })

  const pending = data?.filter((r) => !r.approved) ?? []
  const approved = data?.filter((r) => r.approved) ?? []

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Moderate customer reviews before they go live
          </p>
        </div>
        <Link
          to="/reviews/settings"
          className="text-xs font-medium text-indigo-500 hover:text-indigo-600"
        >
          ⚙ Settings
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">
                Awaiting approval ({pending.length})
              </h2>
              <div className="bg-gray-100 border border-amber-200 overflow-hidden divide-y divide-gray-100">
                {pending.map((r) => (
                  <div key={r.id} className="p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Stars rating={r.rating} />
                        <span className="text-sm font-semibold text-gray-900">
                          {r.customerName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {r.productId.slice(0, 8)}…
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approveMut.mutate({ id: r.id })}
                        disabled={approveMut.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate({ id: r.id })}
                        disabled={deleteMut.isPending}
                        className={btnLinkDanger}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved */}
          {approved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">
                Published ({approved.length})
              </h2>
              <div className="bg-gray-100 border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {approved.map((r) => (
                  <div key={r.id} className="p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Stars rating={r.rating} />
                        <span className="text-sm font-semibold text-gray-900">
                          {r.customerName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate({ id: r.id })}
                      disabled={deleteMut.isPending}
                      className={btnLinkDanger}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!pending.length && !approved.length && (
            <div className="text-center text-gray-400 py-12">No reviews yet.</div>
          )}
        </>
      )}
    </div>
  )
}
