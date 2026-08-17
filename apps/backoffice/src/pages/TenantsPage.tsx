import { useState } from 'react'
import { trpc } from '../trpc.js'

const STATUS_LABELS = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700' },
} as const

export function TenantsPage() {
  const [adding, setAdding] = useState(false)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const utils = trpc.useUtils()

  const { data, isLoading, error } = trpc.admin.tenants.list.useQuery()

  const createMut = trpc.admin.tenants.create.useMutation({
    onSuccess: () => {
      void utils.admin.tenants.list.invalidate()
      setAdding(false)
      setSlug('')
      setName('')
    },
  })
  const setStatusMut = trpc.admin.tenants.setStatus.useMutation({
    onSuccess: () => void utils.admin.tenants.list.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Isolated stores hosted on this instance. Each tenant has its own catalog, categories,
            customers and orders, kept separate from the default store and from each other.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg font-medium"
          >
            + New tenant
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate({ slug, name })
          }}
          className="bg-gray-100 border border-gray-200 rounded-xl p-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tenant-name" className="text-xs text-gray-500 block mb-1">
                Display name
              </label>
              <input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Store"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tenant-slug" className="text-xs text-gray-500 block mb-1">
                Slug (subdomain / routing key)
              </label>
              <input
                id="tenant-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="acme"
                required
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          {createMut.error && <p className="text-xs text-red-600">{createMut.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {error?.data?.code === 'UNAUTHORIZED' ? (
          <div className="p-12 text-center text-sm text-red-600">
            Super admin access required to manage tenants — sign in with the master admin key.
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-400">
            No tenants yet — every product, customer and order currently belongs to the default
            store.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((t) => {
              const status = STATUS_LABELS[t.status]
              return (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
                      {status.label}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setStatusMut.mutate({
                        id: t.id,
                        status: t.status === 'active' ? 'suspended' : 'active',
                      })
                    }
                    className={`text-xs hover:underline ${
                      t.status === 'active' ? 'text-red-500' : 'text-green-600'
                    }`}
                  >
                    {t.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
