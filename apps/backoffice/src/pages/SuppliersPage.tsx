import { useState } from 'react'
import {
  btnLink,
  btnLinkDanger,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  inputCls,
} from '../components/ui.js'
import { trpc } from '../trpc.js'

type SupplierForm = {
  name: string
  contactEmail: string
  contactPhone: string
  address: string
  notes: string
}

const EMPTY: SupplierForm = { name: '', contactEmail: '', contactPhone: '', address: '', notes: '' }

export function SuppliersPage() {
  const utils = trpc.useUtils()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<SupplierForm>(EMPTY)
  const [linkProductId, setLinkProductId] = useState('')
  const [linkSupplierId, setLinkSupplierId] = useState<string | null>(null)
  const [linkRef, setLinkRef] = useState('')
  const [linkPrice, setLinkPrice] = useState('')

  const { data: suppliers = [], isLoading } = trpc.admin.suppliers.list.useQuery()
  const { data: products = [] } = trpc.admin.catalog.list.useQuery({ limit: 200, offset: 0 })

  const createMut = trpc.admin.suppliers.create.useMutation({
    onSuccess() {
      void utils.admin.suppliers.list.invalidate()
      setShowForm(false)
      setForm(EMPTY)
    },
  })

  const updateMut = trpc.admin.suppliers.update.useMutation({
    onSuccess() {
      void utils.admin.suppliers.list.invalidate()
      setEditId(null)
    },
  })

  const deleteMut = trpc.admin.suppliers.delete.useMutation({
    onSuccess() {
      void utils.admin.suppliers.list.invalidate()
    },
  })

  const linkMut = trpc.admin.suppliers.linkProduct.useMutation({
    onSuccess() {
      void utils.admin.suppliers.list.invalidate()
      setLinkSupplierId(null)
      setLinkProductId('')
      setLinkRef('')
      setLinkPrice('')
    },
  })

  function set(field: keyof SupplierForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      ...(form.contactEmail ? { contactEmail: form.contactEmail } : {}),
      ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
      ...(form.address ? { address: form.address } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    }
    if (editId) {
      updateMut.mutate({ id: editId, ...payload })
    } else {
      createMut.mutate(payload)
    }
  }

  function startEdit(s: (typeof suppliers)[0]) {
    setEditId(s.id)
    setForm({
      name: s.name,
      contactEmail: s.contactEmail ?? '',
      contactPhone: s.contactPhone ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    })
    setShowForm(false)
  }

  const isPending = createMut.isPending || updateMut.isPending
  const mutError = createMut.error ?? updateMut.error

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-gray-900">Suppliers</h1>
        {!showForm && !editId && (
          <button type="button" onClick={() => setShowForm(true)} className={btnPrimary}>
            + New supplier
          </button>
        )}
      </div>

      {/* Form */}
      {(showForm || editId) && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-gray-100 border border-gray-200 p-6 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editId ? 'Edit supplier' : 'New supplier'}
          </h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input required value={form.name} onChange={set('name')} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={set('contactEmail')}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact phone</label>
              <input
                value={form.contactPhone}
                onChange={set('contactPhone')}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input value={form.address} onChange={set('address')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={inputCls} />
          </div>
          {mutError && <p className="text-sm text-red-600">{mutError.message}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isPending} className={btnPrimary}>
              {isPending ? 'Saving…' : editId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditId(null)
                setForm(EMPTY)
              }}
              className={btnSecondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : suppliers.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No suppliers yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="bg-gray-100 border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{supplier.name}</p>
                  <div className="flex gap-4 mt-1 text-sm text-gray-500">
                    {supplier.contactEmail && <span>✉ {supplier.contactEmail}</span>}
                    {supplier.contactPhone && <span>☎ {supplier.contactPhone}</span>}
                  </div>
                  {supplier.address && (
                    <p className="text-xs text-gray-400 mt-1">📍 {supplier.address}</p>
                  )}
                  {supplier.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">{supplier.notes}</p>
                  )}
                </div>
                <div className="flex gap-3 ml-4 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setLinkSupplierId(linkSupplierId === supplier.id ? null : supplier.id)
                    }
                    className={btnLink}
                  >
                    Link product
                  </button>
                  <button type="button" onClick={() => startEdit(supplier)} className={btnLink}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete supplier "${supplier.name}"?`))
                        deleteMut.mutate({ id: supplier.id })
                    }}
                    className={btnLinkDanger}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Link product form */}
              {linkSupplierId === supplier.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!linkProductId) return
                    linkMut.mutate({
                      supplierId: supplier.id,
                      productId: linkProductId,
                      ...(linkRef ? { supplierRef: linkRef } : {}),
                      ...(linkPrice
                        ? { unitCostAmount: Math.round(Number.parseFloat(linkPrice) * 100) }
                        : {}),
                    })
                  }}
                  className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-4 gap-3 items-end"
                >
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Product *</label>
                    <select
                      required
                      value={linkProductId}
                      onChange={(e) => setLinkProductId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Supplier ref</label>
                    <input
                      value={linkRef}
                      onChange={(e) => setLinkRef(e.target.value)}
                      placeholder="SKU-123"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Unit cost (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linkPrice}
                      onChange={(e) => setLinkPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-4 flex gap-2">
                    <button type="submit" disabled={linkMut.isPending} className={btnSuccess}>
                      {linkMut.isPending ? 'Linking…' : 'Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkSupplierId(null)}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
