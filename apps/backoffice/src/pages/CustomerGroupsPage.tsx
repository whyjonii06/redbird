import { useState } from 'react'
import { btnLinkDanger, btnPrimary, inputCls } from '../components/ui.js'
import { useI18n } from '../i18n/index.js'
import { fmt, trpc } from '../trpc.js'

export function CustomerGroupsPage() {
  const { t } = useI18n()
  const utils = trpc.useUtils()
  const { data: groups = [], isLoading } = trpc.admin.customerGroups.list.useQuery()

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createTerms, setCreateTerms] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const createMut = trpc.admin.customerGroups.create.useMutation({
    onSuccess: () => {
      void utils.admin.customerGroups.list.invalidate()
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setCreateTerms('')
    },
  })
  const deleteMut = trpc.admin.customerGroups.delete.useMutation({
    onSuccess: () => {
      void utils.admin.customerGroups.list.invalidate()
      setSelectedGroup(null)
    },
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('groups.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('groups.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(!showCreate)
            setSelectedGroup(null)
          }}
          className={btnPrimary}
        >
          {showCreate ? 'Cancel' : '+ New group'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate({
              name: createName,
              description: createDesc || undefined,
              paymentTermsDays: createTerms ? Number(createTerms) : null,
            })
          }}
          className="bg-gray-100 border border-gray-200 p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-700">New customer group</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="VIP customers"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="High-value customers with exclusive pricing"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                B2B payment terms
              </label>
              <select
                value={createTerms}
                onChange={(e) => setCreateTerms(e.target.value)}
                className={inputCls}
              >
                <option value="">Card only</option>
                <option value="15">Net 15</option>
                <option value="30">Net 30</option>
                <option value="60">Net 60</option>
              </select>
            </div>
          </div>
          {createMut.error && <p className="text-sm text-red-500">{createMut.error.message}</p>}
          <button type="submit" disabled={createMut.isPending} className={btnPrimary}>
            {createMut.isPending ? 'Creating…' : 'Create group'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Groups list */}
        <div className="col-span-1 bg-gray-100 border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('groups.empty')}</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(selectedGroup === g.id ? null : g.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedGroup === g.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{g.name}</p>
                    {g.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{g.description}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Group detail */}
        <div className="col-span-2">
          {selectedGroup ? (
            <GroupDetail
              groupId={selectedGroup}
              groupName={groups.find((g) => g.id === selectedGroup)?.name ?? ''}
              paymentTermsDays={
                groups.find((g) => g.id === selectedGroup)?.paymentTermsDays ?? null
              }
              onDelete={() => {
                if (confirm('Delete this group and all its price rules?')) {
                  deleteMut.mutate({ id: selectedGroup })
                }
              }}
            />
          ) : (
            <div className="bg-gray-100 border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Select a group to manage members and price rules
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GroupDetail({
  groupId,
  groupName,
  paymentTermsDays,
  onDelete,
}: {
  groupId: string
  groupName: string
  paymentTermsDays: number | null
  onDelete: () => void
}) {
  const utils = trpc.useUtils()
  const { data: priceRules = [] } = trpc.admin.customerGroups.listPriceRules.useQuery({ groupId })

  const updateMut = trpc.admin.customerGroups.update.useMutation({
    onSuccess: () => void utils.admin.customerGroups.list.invalidate(),
  })

  const [newVariantId, setNewVariantId] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState('EUR')
  const [newMinQty, setNewMinQty] = useState('1')

  const setPriceMut = trpc.admin.customerGroups.setPriceRule.useMutation({
    onSuccess: () => {
      void utils.admin.customerGroups.listPriceRules.invalidate({ groupId })
      setNewVariantId('')
      setNewPrice('')
      setNewMinQty('1')
    },
  })
  const removePriceMut = trpc.admin.customerGroups.removePriceRule.useMutation({
    onSuccess: () => void utils.admin.customerGroups.listPriceRules.invalidate({ groupId }),
  })

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">{groupName} — Price rules</h2>
          <button type="button" onClick={onDelete} className={btnLinkDanger}>
            Delete group
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
          <label htmlFor="group-terms" className="text-xs text-gray-600">
            B2B payment terms
          </label>
          <select
            id="group-terms"
            defaultValue={paymentTermsDays ?? ''}
            onChange={(e) =>
              updateMut.mutate({
                id: groupId,
                paymentTermsDays: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={`${inputCls} w-40`}
          >
            <option value="">Card only</option>
            <option value="15">Net 15</option>
            <option value="30">Net 30</option>
            <option value="60">Net 60</option>
          </select>
          <span className="text-xs text-gray-400">
            {paymentTermsDays
              ? `Members can check out with a purchase order, due in ${paymentTermsDays} days.`
              : 'Members must pay by card at checkout.'}
          </span>
        </div>

        {priceRules.length > 0 ? (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase">
                  Variant ID
                </th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase">
                  Min qty
                </th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase">
                  Price
                </th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {priceRules.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-500 font-mono text-xs">
                    {r.variantId.slice(0, 8)}…
                  </td>
                  <td className="py-2.5 text-right text-gray-600">{r.minQuantity}+</td>
                  <td className="py-2.5 text-right font-medium text-gray-800">
                    {fmt(r.priceAmount, r.priceCurrency)}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removePriceMut.mutate({ id: r.id })}
                      className={btnLinkDanger}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            No price rules yet. Add one below — set "Min qty" to 1 for the group's standard
            wholesale price, or add several rows with higher quantities for volume tiers (e.g. 1+,
            10+, 50+).
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const cents = Math.round(Number.parseFloat(newPrice) * 100)
            const minQuantity = Math.max(1, Number.parseInt(newMinQty, 10) || 1)
            if (newVariantId && !Number.isNaN(cents)) {
              setPriceMut.mutate({
                groupId,
                variantId: newVariantId,
                priceAmount: cents,
                priceCurrency: newCurrency,
                minQuantity,
              })
            }
          }}
          className="grid grid-cols-5 gap-2 items-end"
        >
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Variant UUID</label>
            <input
              value={newVariantId}
              onChange={(e) => setNewVariantId(e.target.value)}
              placeholder="UUID from variants list"
              className={inputCls}
              pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Min qty</label>
            <input
              type="number"
              step="1"
              min="1"
              value={newMinQty}
              onChange={(e) => setNewMinQty(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Currency</label>
            <input
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={setPriceMut.isPending || !newVariantId || !newPrice}
            className={`col-span-5 ${btnPrimary}`}
          >
            {setPriceMut.isPending ? 'Saving…' : 'Add / update price rule'}
          </button>
        </form>
        {setPriceMut.error && (
          <p className="text-xs text-red-500 mt-2">{setPriceMut.error.message}</p>
        )}
      </div>
    </div>
  )
}
