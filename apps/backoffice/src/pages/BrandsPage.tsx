import { useState } from 'react'
import { btnPrimary, btnSecondary, inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

type BrandForm = {
  name: string
  slug: string
  description: string
  logoUrl: string
  websiteUrl: string
}

const EMPTY: BrandForm = { name: '', slug: '', description: '', logoUrl: '', websiteUrl: '' }

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function BrandsPage() {
  const utils = trpc.useUtils()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<BrandForm>(EMPTY)

  const { data: brands = [], isLoading } = trpc.admin.brands.list.useQuery()

  const createMut = trpc.admin.brands.create.useMutation({
    onSuccess() {
      void utils.admin.brands.list.invalidate()
      setShowForm(false)
      setForm(EMPTY)
    },
  })

  const updateMut = trpc.admin.brands.update.useMutation({
    onSuccess() {
      void utils.admin.brands.list.invalidate()
      setEditId(null)
    },
  })

  const deleteMut = trpc.admin.brands.delete.useMutation({
    onSuccess() {
      void utils.admin.brands.list.invalidate()
    },
  })

  function set(field: keyof BrandForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value
      setForm((f) => ({
        ...f,
        [field]: val,
        ...(field === 'name' && !editId ? { slug: slugify(val) } : {}),
      }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      slug: form.slug,
      ...(form.description ? { description: form.description } : {}),
      ...(form.logoUrl ? { logoUrl: form.logoUrl } : {}),
      ...(form.websiteUrl ? { websiteUrl: form.websiteUrl } : {}),
    }
    if (editId) {
      updateMut.mutate({ id: editId, ...payload })
    } else {
      createMut.mutate(payload)
    }
  }

  function startEdit(brand: (typeof brands)[0]) {
    setEditId(brand.id)
    setForm({
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? '',
      logoUrl: brand.logoUrl ?? '',
      websiteUrl: brand.websiteUrl ?? '',
    })
    setShowForm(false)
  }

  const isPending = createMut.isPending || updateMut.isPending
  const mutError = createMut.error ?? updateMut.error

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-gray-900">Brands</h1>
        {!showForm && !editId && (
          <button type="button" onClick={() => setShowForm(true)} className={btnPrimary}>
            + New brand
          </button>
        )}
      </div>

      {/* Form */}
      {(showForm || editId) && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-gray-100 border border-gray-200 p-6 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">{editId ? 'Edit brand' : 'New brand'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input required value={form.name} onChange={set('name')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
              <input
                required
                value={form.slug}
                onChange={set('slug')}
                pattern="[a-z0-9-]+"
                title="lowercase, numbers, dashes only"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={2}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={set('logoUrl')}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
              <input
                type="url"
                value={form.websiteUrl}
                onChange={set('websiteUrl')}
                className={inputCls}
              />
            </div>
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
      ) : brands.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No brands yet.</p>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Brand
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Slug
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Website
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {brand.logoUrl && (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="w-8 h-8 object-contain rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{brand.name}</p>
                        {brand.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">
                            {brand.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{brand.slug}</td>
                  <td className="px-4 py-3">
                    {brand.websiteUrl ? (
                      <a
                        href={brand.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        {brand.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => startEdit(brand)}
                      className="text-indigo-600 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete brand "${brand.name}"?`))
                          deleteMut.mutate({ id: brand.id })
                      }}
                      className="text-red-500 hover:underline text-xs"
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
