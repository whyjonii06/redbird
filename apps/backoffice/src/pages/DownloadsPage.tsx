import { useState } from 'react'
import { trpc } from '../trpc.js'

export function DownloadsPage() {
  const utils = trpc.useUtils()

  const { data: productsRes, isLoading: productsLoading } = trpc.admin.catalog.list.useQuery({
    limit: 100,
    status: 'active',
  })
  const products = productsRes ?? []

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const { data: files = [], isLoading: filesLoading } = trpc.admin.downloads.list.useQuery(
    { productId: selectedProductId! },
    { enabled: !!selectedProductId },
  )

  const [url, setUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [addError, setAddError] = useState('')

  const addMut = trpc.admin.downloads.add.useMutation({
    onSuccess: () => {
      void utils.admin.downloads.list.invalidate({ productId: selectedProductId! })
      setUrl('')
      setFilename('')
      setAddError('')
    },
    onError: (e) => setAddError(e.message),
  })

  const removeMut = trpc.admin.downloads.remove.useMutation({
    onSuccess: () => {
      void utils.admin.downloads.list.invalidate({ productId: selectedProductId! })
    },
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProductId) return
    addMut.mutate({ productId: selectedProductId, url, filename })
  }

  return (
    <div className="p-8 space-y-6" style={{ color: 'var(--bo-text)' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--bo-text)' }}>
          Downloads
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
          Manage downloadable files for virtual products
        </p>
      </div>

      {/* Product picker */}
      <div
        className="p-5 space-y-3"
        style={{
          background: 'var(--bo-bg2)',
          border: '1px solid var(--bo-border)',
        }}
      >
        <label
          className="block text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--bo-muted)' }}
        >
          Select product
        </label>
        {productsLoading ? (
          <div className="h-9 rounded animate-pulse" style={{ background: 'var(--bo-bg3)' }} />
        ) : products.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--bo-muted)' }}>
            No active products found.
          </p>
        ) : (
          <select
            value={selectedProductId ?? ''}
            onChange={(e) => {
              setSelectedProductId(e.target.value || null)
              setUrl('')
              setFilename('')
              setAddError('')
            }}
            className="w-full rounded px-3 py-2 text-sm focus:outline-none"
            style={{
              background: 'var(--bo-bg3)',
              border: '1px solid var(--bo-border2)',
              color: 'var(--bo-text)',
            }}
          >
            <option value="">— Choose a product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isVirtual ? ' (virtual)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Files list */}
      {selectedProductId && (
        <>
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--bo-bg2)',
              border: '1px solid var(--bo-border)',
            }}
          >
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--bo-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
                Files for <span style={{ color: 'var(--bo-accent)' }}>{selectedProduct?.name}</span>
              </h2>
            </div>

            {filesLoading ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--bo-muted)' }}>
                Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--bo-muted)' }}>
                No files yet. Add one below.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bo-border)' }}>
                    <th
                      className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--bo-muted)' }}
                    >
                      Filename
                    </th>
                    <th
                      className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--bo-muted)' }}
                    >
                      URL
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      style={{ borderBottom: '1px solid var(--bo-border)' }}
                      className="last:border-0"
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--bo-text)' }}>
                        {file.filename}
                      </td>
                      <td
                        className="px-5 py-3.5 font-mono text-xs max-w-xs truncate"
                        style={{ color: 'var(--bo-muted)' }}
                        title={file.url}
                      >
                        {file.url}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove "${file.filename}"?`)) {
                              removeMut.mutate({ id: file.id })
                            }
                          }}
                          disabled={removeMut.isPending}
                          className="text-xs transition-colors disabled:opacity-50"
                          style={{ color: 'var(--bo-accent)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add file form */}
          <div
            className="p-5 space-y-4"
            style={{
              background: 'var(--bo-bg2)',
              border: '1px solid var(--bo-border)',
            }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
              Add file
            </h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  URL <span style={{ color: 'var(--bo-accent)' }}>*</span>
                </label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://cdn.example.com/files/product.zip"
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: 'var(--bo-bg3)',
                    border: '1px solid var(--bo-border2)',
                    color: 'var(--bo-text)',
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  Filename <span style={{ color: 'var(--bo-accent)' }}>*</span>
                </label>
                <input
                  required
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="product.zip"
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: 'var(--bo-bg3)',
                    border: '1px solid var(--bo-border2)',
                    color: 'var(--bo-text)',
                  }}
                />
              </div>

              {addError && (
                <p className="text-xs" style={{ color: 'var(--bo-accent)' }}>
                  {addError}
                </p>
              )}

              <button
                type="submit"
                disabled={addMut.isPending || !url || !filename}
                className="text-sm font-medium px-5 py-2 rounded transition-opacity disabled:opacity-50"
                style={{
                  background: 'var(--bo-accent)',
                  color: '#fff',
                }}
              >
                {addMut.isPending ? 'Saving…' : 'Save file'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
