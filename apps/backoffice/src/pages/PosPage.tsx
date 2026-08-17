import { useMemo, useState } from 'react'
import { fmt, trpc } from '../trpc.js'

type CartLine = {
  variantId: string
  productName: string
  variantName: string
  sku: string
  priceAmount: number
  priceCurrency: string
  quantity: number
  available: number
}

type RegisterSession = {
  id: string
  openingCashAmount: number
  cashSalesAmount: number
  cardSalesAmount: number
  expectedCashAmount: number
}

export function PosPage() {
  const utils = trpc.useUtils()
  const { data: session, isLoading: sessionLoading } = trpc.admin.pos.mySession.useQuery()

  if (sessionLoading) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>
  }

  if (!session) {
    return <OpenRegisterForm onOpened={() => void utils.admin.pos.mySession.invalidate()} />
  }

  return <Register session={session} />
}

function OpenRegisterForm({ onOpened }: { onOpened: () => void }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const openMut = trpc.admin.pos.openSession.useMutation({ onSuccess: onOpened })

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Open register</h1>
      <p className="text-sm text-gray-500 mb-6">
        Count the starting cash float before ringing up any sales.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          openMut.mutate({
            openingCashAmount: Math.round(Number(amount || '0') * 100),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          })
        }}
        className="bg-gray-100 border border-gray-200 rounded-xl p-6 space-y-4"
      >
        <div>
          <label htmlFor="opening-cash" className="block text-sm font-medium text-gray-700 mb-1">
            Opening cash amount
          </label>
          <input
            id="opening-cash"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="opening-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="opening-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
        {openMut.error && <p className="text-xs text-red-600">{openMut.error.message}</p>}
        <button
          type="submit"
          disabled={openMut.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {openMut.isPending ? 'Opening…' : 'Open register'}
        </button>
      </form>
    </div>
  )
}

function Register({ session }: { session: RegisterSession }) {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [tenderType, setTenderType] = useState<'cash' | 'card'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [receipt, setReceipt] = useState<{
    number: string
    total: number
    changeDue: number
  } | null>(null)
  const [closing, setClosing] = useState(false)
  const [closingAmount, setClosingAmount] = useState('')

  const { data: searchResults = [] } = trpc.admin.pos.searchProducts.useQuery(
    { q: search.trim() },
    { enabled: search.trim().length > 0 },
  )

  const matches = useMemo(
    () => searchResults.map((v) => ({ ...v, quantity: 1 })).slice(0, 8),
    [searchResults],
  )

  const ringMut = trpc.admin.pos.ringSale.useMutation({
    onSuccess: (result) => {
      setReceipt({
        number: result.order.number,
        total: result.order.totalAmount,
        changeDue: result.changeDue,
      })
      setCartLines([])
      setCashReceived('')
    },
  })

  const closeMut = trpc.admin.pos.closeSession.useMutation({
    onSuccess: () => {
      void utils.admin.pos.mySession.invalidate()
    },
  })

  function addLine(line: CartLine) {
    setCartLines((lines) => {
      const existing = lines.find((l) => l.variantId === line.variantId)
      if (existing) {
        return lines.map((l) =>
          l.variantId === line.variantId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...lines, line]
    })
    setSearch('')
  }

  function setQty(variantId: string, quantity: number) {
    setCartLines((lines) =>
      quantity <= 0
        ? lines.filter((l) => l.variantId !== variantId)
        : lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
    )
  }

  const total = cartLines.reduce((sum, l) => sum + l.priceAmount * l.quantity, 0)
  const currency = cartLines[0]?.priceCurrency ?? 'EUR'
  const cashReceivedCents = Math.round(Number(cashReceived || '0') * 100)
  const changeDue = tenderType === 'cash' ? Math.max(0, cashReceivedCents - total) : 0

  if (closing) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Close register</h1>
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-6 space-y-3 mt-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Opening float</span>
            <span className="font-medium">{fmt(session.openingCashAmount, 'EUR')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cash sales</span>
            <span className="font-medium">{fmt(session.cashSalesAmount, 'EUR')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Card sales</span>
            <span className="font-medium">{fmt(session.cardSalesAmount, 'EUR')}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
            <span className="text-gray-700 font-medium">Expected cash in drawer</span>
            <span className="font-semibold">{fmt(session.expectedCashAmount, 'EUR')}</span>
          </div>
          <div>
            <label
              htmlFor="closing-cash"
              className="block text-sm font-medium text-gray-700 mb-1 mt-4"
            >
              Counted cash
            </label>
            <input
              id="closing-cash"
              type="number"
              min="0"
              step="0.01"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          {closingAmount && (
            <p
              className={`text-xs ${
                Math.round(Number(closingAmount) * 100) === session.expectedCashAmount
                  ? 'text-green-600'
                  : 'text-amber-600'
              }`}
            >
              {Math.round(Number(closingAmount) * 100) - session.expectedCashAmount === 0
                ? 'Matches expected amount.'
                : `${Math.round(Number(closingAmount) * 100) - session.expectedCashAmount > 0 ? 'Over' : 'Short'} by ${fmt(Math.abs(Math.round(Number(closingAmount) * 100) - session.expectedCashAmount), 'EUR')}.`}
            </p>
          )}
          {closeMut.error && <p className="text-xs text-red-600">{closeMut.error.message}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                closeMut.mutate({
                  id: session.id,
                  closingCashAmount: Math.round(Number(closingAmount || '0') * 100),
                })
              }
              disabled={closeMut.isPending || !closingAmount}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {closeMut.isPending ? 'Closing…' : 'Close register'}
            </button>
            <button
              type="button"
              onClick={() => setClosing(false)}
              className="px-4 border border-gray-200 rounded-lg text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-gray-900">Register</h1>
          <button
            type="button"
            onClick={() => setClosing(true)}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Close register →
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name or SKU…"
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm"
        />

        {matches.length > 0 && (
          <div className="bg-gray-100 border border-gray-200 rounded-lg divide-y divide-gray-100">
            {matches.map((m) => (
              <button
                key={m.variantId}
                type="button"
                onClick={() => addLine(m)}
                disabled={m.available <= 0}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-40"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.productName}
                    {m.variantName && <span className="text-gray-400"> — {m.variantName}</span>}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {m.sku} · {m.available} in stock
                  </p>
                </div>
                <span className="text-sm font-semibold">{fmt(m.priceAmount, m.priceCurrency)}</span>
              </button>
            ))}
          </div>
        )}

        {receipt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-800">
              ✓ Sale complete — order #{receipt.number}
            </p>
            <p className="text-xs text-green-700 mt-1">
              Total {fmt(receipt.total, 'EUR')}
              {receipt.changeDue > 0 && ` · Change due: ${fmt(receipt.changeDue, 'EUR')}`}
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-5 sticky top-6">
          <h2 className="font-semibold text-gray-900 mb-3">Cart</h2>
          {cartLines.length === 0 ? (
            <p className="text-sm text-gray-400">No items yet — search above to add one.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {cartLines.map((l) => (
                <div key={l.variantId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{l.productName}</p>
                    <p className="text-xs text-gray-400 font-mono">{l.sku}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(l.variantId, l.quantity - 1)}
                      className="w-6 h-6 rounded border border-gray-300 text-xs"
                    >
                      −
                    </button>
                    <span className="w-5 text-center">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.variantId, l.quantity + 1)}
                      disabled={l.quantity >= l.available}
                      className="w-6 h-6 rounded border border-gray-300 text-xs disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 text-right font-medium shrink-0">
                    {fmt(l.priceAmount * l.quantity, l.priceCurrency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-4">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">{fmt(total, currency)}</span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setTenderType('cash')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tenderType === 'cash' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Cash
            </button>
            <button
              type="button"
              onClick={() => setTenderType('card')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tenderType === 'card' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Card
            </button>
          </div>

          {tenderType === 'cash' && (
            <div className="mb-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Cash received"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              {cashReceivedCents > 0 && (
                <p className="text-xs text-gray-500 mt-1">Change due: {fmt(changeDue, currency)}</p>
              )}
            </div>
          )}

          {ringMut.error && <p className="text-xs text-red-600 mb-2">{ringMut.error.message}</p>}

          <button
            type="button"
            disabled={
              cartLines.length === 0 ||
              ringMut.isPending ||
              (tenderType === 'cash' && cashReceivedCents < total)
            }
            onClick={() =>
              ringMut.mutate({
                registerSessionId: session.id,
                items: cartLines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
                tenderType,
                ...(tenderType === 'cash' ? { cashReceived: cashReceivedCents } : {}),
              })
            }
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {ringMut.isPending ? 'Processing…' : 'Complete sale'}
          </button>
        </div>
      </div>
    </div>
  )
}
