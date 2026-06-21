import { useState } from 'react'
import { trpc } from '../trpc.js'

export function AbandonedCartsPage() {
  const { data: carts = [], isLoading, refetch } = trpc.admin.abandonedCart.list.useQuery()
  const [recoveryResult, setRecoveryResult] = useState<{
    processed: number
    emailed: number
    skipped: number
  } | null>(null)

  const recoveryMut = trpc.admin.abandonedCart.runRecovery.useMutation({
    onSuccess: (result) => {
      setRecoveryResult(result)
      void refetch()
    },
  })

  return (
    <div className="p-8 space-y-6" style={{ color: 'var(--bo-text)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--bo-text)' }}>
            Abandoned Carts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
            Carts abandoned in the last 30 days
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRecoveryResult(null)
            recoveryMut.mutate({})
          }}
          disabled={recoveryMut.isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--bo-accent)', color: '#fff' }}
        >
          {recoveryMut.isPending ? 'Running…' : 'Run Recovery'}
        </button>
      </div>

      {recoveryResult && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(34,197,94,0.10)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#22c55e',
          }}
        >
          {recoveryResult.processed} carts processed, {recoveryResult.emailed} emails sent
        </div>
      )}

      {recoveryMut.isError && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(232,48,42,0.10)',
            border: '1px solid rgba(232,48,42,0.25)',
            color: 'var(--bo-accent)',
          }}
        >
          Recovery failed: {recoveryMut.error.message}
        </div>
      )}

      <div
        className="overflow-hidden rounded-xl"
        style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bo-border)' }}>
              <th
                className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--bo-muted)' }}
              >
                Customer
              </th>
              <th
                className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--bo-muted)' }}
              >
                Items
              </th>
              <th
                className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--bo-muted)' }}
              >
                Abandoned
              </th>
              <th
                className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--bo-muted)' }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && carts.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  No abandoned carts
                </td>
              </tr>
            )}
            {carts.map((cart) => (
              <tr key={cart.id} style={{ borderBottom: '1px solid var(--bo-border)' }}>
                <td className="px-5 py-3.5" style={{ color: 'var(--bo-text)' }}>
                  {cart.customerEmail ?? <span style={{ color: 'var(--bo-muted)' }}>—</span>}
                </td>
                <td className="px-5 py-3.5" style={{ color: 'var(--bo-text)' }}>
                  {cart.lineItems.length}
                </td>
                <td className="px-5 py-3.5" style={{ color: 'var(--bo-muted)' }}>
                  {new Date(cart.updatedAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(232,48,42,0.12)', color: 'var(--bo-accent)' }}
                  >
                    Abandoned
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
