import { useState } from 'react'
import { btnLink, btnLinkDanger, btnPrimary, btnSecondary, inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

type WarehouseForm = {
  name: string
  code: string
  isDefault: boolean
}

const EMPTY: WarehouseForm = { name: '', code: '', isDefault: false }

export function WarehousesPage() {
  const utils = trpc.useUtils()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<WarehouseForm>(EMPTY)

  const { data: warehouses = [], isLoading } = trpc.admin.warehouses.list.useQuery()

  const createMut = trpc.admin.warehouses.create.useMutation({
    onSuccess() {
      void utils.admin.warehouses.list.invalidate()
      setShowForm(false)
      setForm(EMPTY)
    },
  })
  const updateMut = trpc.admin.warehouses.update.useMutation({
    onSuccess() {
      void utils.admin.warehouses.list.invalidate()
      setEditId(null)
    },
  })
  const deleteMut = trpc.admin.warehouses.delete.useMutation({
    onSuccess() {
      void utils.admin.warehouses.list.invalidate()
    },
  })

  function startEdit(w: (typeof warehouses)[number]) {
    setEditId(w.id)
    setForm({ name: w.name, code: w.code, isDefault: w.isDefault })
    setShowForm(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editId) {
      updateMut.mutate({ id: editId, ...form })
    } else {
      createMut.mutate(form)
    }
  }

  const mutError = createMut.error ?? updateMut.error
  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Stock locations — track where each variant's inventory physically sits.
          </p>
        </div>
        {!showForm && !editId && (
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY)
              setShowForm(true)
            }}
            className={btnPrimary}
          >
            + New warehouse
          </button>
        )}
      </div>

      {(showForm || editId) && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-100 border border-gray-200 p-6 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editId ? 'Edit warehouse' : 'New warehouse'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
                placeholder="Main warehouse"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={inputCls}
                placeholder="MAIN"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="wh-default"
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="wh-default" className="text-sm text-gray-700 cursor-pointer">
              Default warehouse
            </label>
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

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : warehouses.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No warehouses yet. All stock is tracked as one pool.</p>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Code
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {warehouses.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{w.name}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{w.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {w.isDefault && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                          Default
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                      >
                        {w.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button type="button" onClick={() => startEdit(w)} className={btnLink}>
                      Edit
                    </button>
                    {w.active && (
                      <button
                        type="button"
                        onClick={() => updateMut.mutate({ id: w.id, active: false })}
                        className={btnLink}
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete warehouse "${w.name}"? Its stock records go with it.`))
                          deleteMut.mutate({ id: w.id })
                      }}
                      className={btnLinkDanger}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
