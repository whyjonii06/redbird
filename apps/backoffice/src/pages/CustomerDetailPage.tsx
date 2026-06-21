import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge.js'
import { btnLink, btnSmPrimary } from '../components/ui.js'
import { fmt, fmtDate, trpc } from '../trpc.js'

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = trpc.admin.customers.get.useQuery({ id: id! })

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>
  if (error) return <div className="p-8 text-red-500">{error.message}</div>
  if (!data) return null

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email

  return (
    <div className="p-8 space-y-6">
      <Link to="/customers" className="text-sm text-indigo-600 hover:underline">
        ← Back to customers
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{fullName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.email}</p>
        </div>
        <p className="text-xs text-gray-400">Joined {fmtDate(data.createdAt)}</p>
      </div>

      {/* Loyalty */}
      <LoyaltyAdminSection customerId={id!} />

      {/* Orders */}
      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Orders ({data.orders.length})</h2>
        </div>
        {data.orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No orders yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Order
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{o.number}</td>
                  <td className="px-5 py-3.5 text-gray-500">{fmtDate(o.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <Badge value={o.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-800">
                    {fmt(o.totalAmount, o.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link to={`/orders/${o.id}`} className={btnLink}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function LoyaltyAdminSection({ customerId }: { customerId: string }) {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.admin.loyalty.getAccount.useQuery({ customerId })
  const [pts, setPts] = useState('')
  const [desc, setDesc] = useState('')

  const adjustMut = trpc.admin.loyalty.adjust.useMutation({
    onSuccess() {
      void utils.admin.loyalty.getAccount.invalidate({ customerId })
      setPts('')
      setDesc('')
    },
  })

  if (isLoading) return null

  const balance = data?.balance ?? 0
  const transactions = data?.transactions ?? []

  return (
    <div className="bg-gray-100 border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">Loyalty points</h2>
        <span className="text-lg font-bold text-indigo-600">{balance} pts</span>
      </div>

      {/* Adjust */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number.parseInt(pts, 10)
          if (!Number.isNaN(n) && desc)
            adjustMut.mutate({ customerId, points: n, description: desc })
        }}
        className="flex gap-2"
      >
        <input
          type="number"
          value={pts}
          onChange={(e) => setPts(e.target.value)}
          placeholder="+100 or -50"
          className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Reason"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={adjustMut.isPending || !pts || !desc}
          className={btnSmPrimary}
        >
          Adjust
        </button>
      </form>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="divide-y divide-gray-50 text-sm">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-2 flex items-center justify-between">
              <div>
                <p className="text-gray-700">{tx.description}</p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`font-semibold ${tx.points >= 0 ? 'text-green-600' : 'text-red-500'}`}
              >
                {tx.points > 0 ? '+' : ''}
                {tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
