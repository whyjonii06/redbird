import { useState } from 'react'
import { Link } from 'react-router-dom'
import { btnLink, btnPrimary, inputCls } from '../components/ui.js'
import { fmtDate, trpc } from '../trpc.js'

export function LoyaltyPage() {
  const utils = trpc.useUtils()
  const { data: accounts = [], isLoading } = trpc.admin.loyalty.listAccounts.useQuery()

  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustPts, setAdjustPts] = useState('')
  const [adjustDesc, setAdjustDesc] = useState('')

  const adjustMut = trpc.admin.loyalty.adjust.useMutation({
    onSuccess: () => {
      void utils.admin.loyalty.listAccounts.invalidate()
      setAdjustId(null)
      setAdjustPts('')
      setAdjustDesc('')
    },
  })

  const totalPoints = accounts.reduce((s, a) => s + a.balance, 0)
  const activeAccounts = accounts.filter((a) => a.balance > 0).length

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Loyalty program</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customer points balances and adjustments</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-100 border border-gray-200 border-l-2 border-l-indigo-600 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Accounts
          </p>
          <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
        </div>
        <div className="bg-gray-100 border border-gray-200 border-l-2 border-l-indigo-600 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            With balance
          </p>
          <p className="text-2xl font-bold text-gray-900">{activeAccounts}</p>
        </div>
        <div className="bg-gray-100 border border-gray-200 border-l-2 border-l-indigo-600 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Total points outstanding
          </p>
          <p className="text-2xl font-bold text-indigo-600">{totalPoints.toLocaleString()}</p>
        </div>
      </div>

      {/* Adjust panel */}
      {adjustId && (
        <div className="bg-indigo-50 border border-indigo-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Adjust points</h2>
            <button
              type="button"
              onClick={() => setAdjustId(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const pts = Number.parseInt(adjustPts, 10)
              if (Number.isNaN(pts)) return
              adjustMut.mutate({ customerId: adjustId, points: pts, description: adjustDesc })
            }}
            className="flex gap-3 items-end"
          >
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">
                Points (use negative to deduct)
              </label>
              <input
                type="number"
                value={adjustPts}
                onChange={(e) => setAdjustPts(e.target.value)}
                placeholder="+100 or -50"
                required
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Reason *</label>
              <input
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                placeholder="Manual adjustment — reason"
                required
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={adjustMut.isPending || !adjustPts || !adjustDesc}
              className={btnPrimary}
            >
              {adjustMut.isPending ? 'Saving…' : 'Apply'}
            </button>
          </form>
          {adjustMut.error && (
            <p className="text-xs text-red-500 mt-2">{adjustMut.error.message}</p>
          )}
          {adjustMut.isSuccess && <p className="text-xs text-green-600 mt-2">Points adjusted.</p>}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Customer
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Email
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Balance
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Created
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No loyalty accounts yet.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr
                key={a.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${adjustId === a.customerId ? 'bg-indigo-50' : ''}`}
              >
                <td className="px-5 py-3.5 font-medium text-gray-900">
                  {a.customer ? (
                    <Link to={`/customers/${a.customerId}`} className="hover:text-indigo-600">
                      {[a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ') || '—'}
                    </Link>
                  ) : (
                    <span className="text-gray-400 font-mono text-xs">
                      {a.customerId.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">{a.customer?.email ?? '—'}</td>
                <td className="px-5 py-3.5 text-right">
                  <span
                    className={`font-semibold ${a.balance > 0 ? 'text-indigo-600' : 'text-gray-400'}`}
                  >
                    {a.balance.toLocaleString()} pts
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">{fmtDate(a.createdAt)}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustId(adjustId === a.customerId ? null : a.customerId)
                      setAdjustPts('')
                      setAdjustDesc('')
                    }}
                    className={btnLink}
                  >
                    Adjust
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
