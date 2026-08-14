import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { trpc } from '../trpc.js'

export function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const unsubMut = trpc.customers.unsubscribe.useMutation()

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per token, not on every mutation identity change
  useEffect(() => {
    if (token) unsubMut.mutate({ token })
  }, [token])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {!token ? (
        <p className="text-gray-600">This unsubscribe link is missing its token.</p>
      ) : unsubMut.isPending ? (
        <p className="text-gray-500">Unsubscribing…</p>
      ) : unsubMut.data?.success ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
          <p className="text-lg font-semibold text-green-800 mb-2">You're unsubscribed</p>
          <p className="text-sm text-green-700">
            You won't receive marketing emails from us anymore.
          </p>
        </div>
      ) : (
        <p className="text-gray-600">This unsubscribe link is invalid or has expired.</p>
      )}
      <Link to="/" className="mt-6 inline-block text-sm text-[var(--primary)] hover:underline">
        Back to store
      </Link>
    </div>
  )
}
