import { useState } from 'react'
import { Badge } from '../components/Badge.js'
import { btnPrimary, inputCls } from '../components/ui.js'
import { useI18n } from '../i18n/index.js'
import { fmt, fmtDate, trpc } from '../trpc.js'

type PromoType = 'percentage' | 'fixed' | 'bogo' | 'tiered'

type PromoRow = {
  id: string
  code: string
  type: PromoType
  value: number
  currency: string | null
  minimumAmount: number | null
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  active: boolean
  bogoConfig: { buyQuantity: number; getQuantity: number; getDiscountPercent: number } | null
  tiers: Array<{ minQuantity: number; discountPercent: number }> | null
}

type TierRow = { minQuantity: string; discountPercent: string }

type FormState = {
  type: PromoType
  value: string
  currency: string
  minAmount: string
  maxUses: string
  expiresAt: string
  active: boolean
  buyQuantity: string
  getQuantity: string
  getDiscountPercent: string
  tiers: TierRow[]
}

const EMPTY_FORM: FormState = {
  type: 'percentage',
  value: '',
  currency: 'EUR',
  minAmount: '',
  maxUses: '',
  expiresAt: '',
  active: true,
  buyQuantity: '1',
  getQuantity: '1',
  getDiscountPercent: '100',
  tiers: [{ minQuantity: '3', discountPercent: '10' }],
}

export function PromosPage() {
  const { t } = useI18n()
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.admin.promos.list.useQuery()

  const deactivate = trpc.admin.promos.deactivate.useMutation({
    onSuccess: () => utils.admin.promos.list.invalidate(),
  })
  const deleteMut = trpc.admin.promos.delete.useMutation({
    onSuccess: () => utils.admin.promos.list.invalidate(),
  })
  const create = trpc.admin.promos.create.useMutation({
    onSuccess: () => {
      utils.admin.promos.list.invalidate()
      setShowCreate(false)
      setCreateCode('')
      setCreateForm(EMPTY_FORM)
    },
  })
  const update = trpc.admin.promos.update.useMutation({
    onSuccess: () => {
      utils.admin.promos.list.invalidate()
      setEditId(null)
    },
  })

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [createCode, setCreateCode] = useState('')
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM)

  // Edit form state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  function startEdit(p: PromoRow) {
    setEditId(p.id)
    setEditForm({
      type: p.type,
      value: p.type === 'percentage' ? String(p.value) : (p.value / 100).toFixed(2),
      currency: p.currency ?? 'EUR',
      minAmount: p.minimumAmount != null ? (p.minimumAmount / 100).toFixed(2) : '',
      maxUses: p.maxUses != null ? String(p.maxUses) : '',
      expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 16) : '',
      active: p.active,
      buyQuantity: p.bogoConfig ? String(p.bogoConfig.buyQuantity) : '1',
      getQuantity: p.bogoConfig ? String(p.bogoConfig.getQuantity) : '1',
      getDiscountPercent: p.bogoConfig ? String(p.bogoConfig.getDiscountPercent) : '100',
      tiers: p.tiers?.length
        ? p.tiers.map((t) => ({
            minQuantity: String(t.minQuantity),
            discountPercent: String(t.discountPercent),
          }))
        : EMPTY_FORM.tiers,
    })
    setShowCreate(false)
  }

  /** Shared value/bogoConfig/tiers payload derived from a form, keyed by type. */
  function buildTypeFields(form: FormState) {
    if (form.type === 'bogo') {
      return {
        value: 0,
        bogoConfig: {
          buyQuantity: Number.parseInt(form.buyQuantity, 10),
          getQuantity: Number.parseInt(form.getQuantity, 10),
          getDiscountPercent: Number.parseInt(form.getDiscountPercent, 10),
        },
      }
    }
    if (form.type === 'tiered') {
      return {
        value: 0,
        tiers: form.tiers.map((t) => ({
          minQuantity: Number.parseInt(t.minQuantity, 10),
          discountPercent: Number.parseInt(t.discountPercent, 10),
        })),
      }
    }
    return {
      value: Math.round(
        form.type === 'percentage' ? Number(form.value) : Number.parseFloat(form.value) * 100,
      ),
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    create.mutate({
      code: createCode.toUpperCase(),
      type: createForm.type,
      currency: createForm.type === 'fixed' ? createForm.currency : undefined,
      minimumAmount: createForm.minAmount
        ? Math.round(Number.parseFloat(createForm.minAmount) * 100)
        : undefined,
      maxUses: createForm.maxUses ? Number.parseInt(createForm.maxUses, 10) : undefined,
      expiresAt: createForm.expiresAt ? new Date(createForm.expiresAt).toISOString() : undefined,
      ...buildTypeFields(createForm),
    })
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    update.mutate({
      id: editId,
      type: editForm.type,
      currency: editForm.type === 'fixed' ? editForm.currency : undefined,
      minimumAmount: editForm.minAmount
        ? Math.round(Number.parseFloat(editForm.minAmount) * 100)
        : null,
      maxUses: editForm.maxUses ? Number.parseInt(editForm.maxUses, 10) : null,
      expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      active: editForm.active,
      ...buildTypeFields(editForm),
    })
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('promos.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('promos.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(!showCreate)
            setEditId(null)
          }}
          className={btnPrimary}
        >
          {showCreate ? 'Cancel' : '+ New code'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-100 border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">New promo code</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="SUMMER20"
                required
              />
            </div>
            <PromoFields form={createForm} onChange={setCreateForm} />
          </div>
          {create.error && <p className="text-sm text-red-500">{create.error.message}</p>}
          <button type="submit" disabled={create.isPending} className={btnPrimary}>
            Create code
          </button>
        </form>
      )}

      {/* Edit form */}
      {editId && (
        <form
          onSubmit={handleUpdate}
          className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Edit promo code</h2>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PromoFields form={editForm} onChange={setEditForm} showActive />
          </div>
          {update.error && <p className="text-sm text-red-500">{update.error.message}</p>}
          <button
            type="submit"
            disabled={update.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}

      {/* Table */}
      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Code
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Type
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Value
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Uses
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Expires
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  {t('promos.empty')}
                </td>
              </tr>
            )}
            {data?.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${editId === p.id ? 'bg-amber-50' : ''}`}
              >
                <td className="px-5 py-3.5 font-mono font-semibold text-gray-900">{p.code}</td>
                <td className="px-5 py-3.5">
                  <Badge value={p.type} />
                </td>
                <td className="px-5 py-3.5 text-gray-700">
                  {p.type === 'percentage' && `${p.value}%`}
                  {p.type === 'fixed' && fmt(p.value, p.currency ?? 'EUR')}
                  {p.type === 'bogo' && p.bogoConfig && (
                    <span className="font-mono text-xs">
                      Buy {p.bogoConfig.buyQuantity} get {p.bogoConfig.getQuantity} @{' '}
                      {p.bogoConfig.getDiscountPercent}% off
                    </span>
                  )}
                  {p.type === 'tiered' && p.tiers && (
                    <span className="font-mono text-xs">
                      {p.tiers.map((t) => `${t.minQuantity}+ → ${t.discountPercent}%`).join(', ')}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-600">
                  {p.usedCount}
                  {p.maxUses ? ` / ${p.maxUses}` : ''}
                </td>
                <td className="px-5 py-3.5 text-gray-500">
                  {p.expiresAt ? fmtDate(p.expiresAt) : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <Badge value={p.active ? 'active' : 'archived'} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Edit
                    </button>
                    {p.active && (
                      <button
                        type="button"
                        onClick={() => deactivate.mutate({ id: p.id })}
                        className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete promo code "${p.code}"? This cannot be undone.`))
                          deleteMut.mutate({ id: p.id })
                      }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PromoFields({
  form,
  onChange,
  showActive,
}: {
  form: FormState
  onChange: (f: FormState) => void
  showActive?: boolean
}) {
  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...form, [field]: e.target.value })
  }
  function setTier(index: number, field: keyof TierRow, value: string) {
    const tiers = form.tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    onChange({ ...form, tiers })
  }
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
        <select value={form.type} onChange={set('type')} className={inputCls}>
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed amount</option>
          <option value="bogo">Buy X get Y (BOGO)</option>
          <option value="tiered">Quantity tiers</option>
        </select>
      </div>
      {(form.type === 'percentage' || form.type === 'fixed') && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Value {form.type === 'percentage' ? '(%)' : `(${form.currency})`}
          </label>
          <input
            type="number"
            step={form.type === 'percentage' ? '1' : '0.01'}
            min="1"
            max={form.type === 'percentage' ? '100' : undefined}
            value={form.value}
            onChange={set('value')}
            className={inputCls}
            required
            placeholder={form.type === 'percentage' ? '20' : '10.00'}
          />
        </div>
      )}
      {form.type === 'fixed' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
          <input
            value={form.currency}
            onChange={(e) => onChange({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputCls}
            maxLength={3}
          />
        </div>
      )}
      {form.type === 'bogo' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buy quantity</label>
            <input
              type="number"
              min="1"
              value={form.buyQuantity}
              onChange={set('buyQuantity')}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Get quantity</label>
            <input
              type="number"
              min="1"
              value={form.getQuantity}
              onChange={set('getQuantity')}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Discount on "get" units (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.getDiscountPercent}
              onChange={set('getDiscountPercent')}
              className={inputCls}
              required
              placeholder="100 = free"
            />
          </div>
        </>
      )}
      {form.type === 'tiered' && (
        <div className="col-span-2 space-y-2">
          <label className="block text-xs font-medium text-gray-500">
            Quantity tiers (highest matching tier applies)
          </label>
          {form.tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={tier.minQuantity}
                onChange={(e) => setTier(i, 'minQuantity', e.target.value)}
                className={inputCls}
                placeholder="Min qty"
                required
              />
              <span className="text-xs text-gray-400">units →</span>
              <input
                type="number"
                min="1"
                max="100"
                value={tier.discountPercent}
                onChange={(e) => setTier(i, 'discountPercent', e.target.value)}
                className={inputCls}
                placeholder="% off"
                required
              />
              <span className="text-xs text-gray-400">%</span>
              {form.tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...form, tiers: form.tiers.filter((_, idx) => idx !== i) })
                  }
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...form,
                tiers: [...form.tiers, { minQuantity: '', discountPercent: '' }],
              })
            }
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            + Add tier
          </button>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Minimum order amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.minAmount}
          onChange={set('minAmount')}
          className={inputCls}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Max uses</label>
        <input
          type="number"
          min="1"
          value={form.maxUses}
          onChange={set('maxUses')}
          className={inputCls}
          placeholder="Unlimited"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Expires at</label>
        <input
          type="datetime-local"
          value={form.expiresAt}
          onChange={set('expiresAt')}
          className={inputCls}
        />
      </div>
      {showActive && (
        <div className="flex items-center gap-2 pt-1">
          <input
            id="promo-active"
            type="checkbox"
            checked={form.active}
            onChange={(e) => onChange({ ...form, active: e.target.checked })}
            className="w-4 h-4 accent-indigo-600"
          />
          <label htmlFor="promo-active" className="text-sm text-gray-700 cursor-pointer">
            Active
          </label>
        </div>
      )}
    </>
  )
}
