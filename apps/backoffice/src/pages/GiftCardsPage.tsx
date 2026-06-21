import { useState } from 'react'
import { trpc } from '../trpc.js'

function fmt(cents: number, currency: string) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency })
}

export function GiftCardsPage() {
  const utils = trpc.useUtils()
  const { data: cards = [], isLoading } = trpc.admin.giftCards.list.useQuery()

  const [showCreate, setShowCreate] = useState(false)
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [createError, setCreateError] = useState('')

  const createMut = trpc.admin.giftCards.create.useMutation({
    onSuccess: () => {
      utils.admin.giftCards.list.invalidate()
      setShowCreate(false)
      setBalance('')
      setCode('')
      setEmail('')
      setExpiresAt('')
      setCreateError('')
    },
    onError: (e) => setCreateError(e.message),
  })

  const voidMut = trpc.admin.giftCards.void.useMutation({
    onSuccess: () => utils.admin.giftCards.list.invalidate(),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const balanceCents = Math.round(Number.parseFloat(balance) * 100)
    if (!balanceCents || balanceCents <= 0) {
      setCreateError('Balance must be greater than 0')
      return
    }
    createMut.mutate({
      balance: balanceCents,
      currency,
      ...(code ? { code: code.toUpperCase() } : {}),
      ...(email ? { issuedToEmail: email } : {}),
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    })
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-gray-900">Gift Cards</h1>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showCreate ? 'Cancel' : '+ Create gift card'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-100 border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">New gift card</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Balance <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="50.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Code (leave blank to auto-generate)
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Issued to email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Expiry date (optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}

          <button
            type="submit"
            disabled={createMut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No gift cards yet.</p>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Code
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Balance / Initial
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Issued to
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Expires
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => {
                const isExpired = card.expiresAt !== null && new Date() > new Date(card.expiresAt)
                const isEmpty = card.balance <= 0
                const status = isExpired ? 'expired' : isEmpty ? 'used' : 'active'
                return (
                  <tr key={card.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                      {card.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-semibold">{fmt(card.balance, card.currency)}</span>
                      <span className="text-gray-400 ml-1">
                        / {fmt(card.initialBalance, card.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{card.issuedToEmail ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : status === 'used'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Void this gift card?')) voidMut.mutate({ id: card.id })
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
