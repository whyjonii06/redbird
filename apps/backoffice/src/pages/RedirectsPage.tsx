import { useState } from 'react'
import { btnLink, btnLinkDanger, btnPrimary, btnSecondary, inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

type RedirectForm = {
  fromPath: string
  toPath: string
  statusCode: '301' | '302'
}

const EMPTY: RedirectForm = { fromPath: '', toPath: '', statusCode: '301' }

export function RedirectsPage() {
  const utils = trpc.useUtils()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<RedirectForm>(EMPTY)

  const { data: redirects = [], isLoading } = trpc.admin.redirects.list.useQuery()

  const createMut = trpc.admin.redirects.create.useMutation({
    onSuccess() {
      void utils.admin.redirects.list.invalidate()
      setShowForm(false)
      setForm(EMPTY)
    },
  })
  const updateMut = trpc.admin.redirects.update.useMutation({
    onSuccess() {
      void utils.admin.redirects.list.invalidate()
      setEditId(null)
    },
  })
  const deleteMut = trpc.admin.redirects.delete.useMutation({
    onSuccess() {
      void utils.admin.redirects.list.invalidate()
    },
  })

  function startEdit(r: (typeof redirects)[number]) {
    setEditId(r.id)
    setForm({ fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode })
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
          <h1 className="font-display text-2xl font-bold text-gray-900">Redirects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Send visitors of an old URL to a new one instead of a 404 — e.g. after renaming a
            product or category slug.
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
            + New redirect
          </button>
        )}
      </div>

      {(showForm || editId) && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-100 border border-gray-200 p-6 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editId ? 'Edit redirect' : 'New redirect'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From path *</label>
              <input
                required
                value={form.fromPath}
                onChange={(e) => setForm({ ...form, fromPath: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="/old-product-slug"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To *</label>
              <input
                required
                value={form.toPath}
                onChange={(e) => setForm({ ...form, toPath: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="/products/new-slug or https://…"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.statusCode}
              onChange={(e) => setForm({ ...form, statusCode: e.target.value as '301' | '302' })}
              className={inputCls}
            >
              <option value="301">301 — Permanent</option>
              <option value="302">302 — Temporary</option>
            </select>
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
      ) : redirects.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No redirects yet.</p>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  From
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  To
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {redirects.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">{r.fromPath}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.toPath}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.statusCode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                    >
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button type="button" onClick={() => startEdit(r)} className={btnLink}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMut.mutate({ id: r.id, active: !r.active })}
                      className={btnLink}
                    >
                      {r.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete redirect from "${r.fromPath}"?`))
                          deleteMut.mutate({ id: r.id })
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
