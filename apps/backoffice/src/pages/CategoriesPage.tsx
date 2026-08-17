import { useState } from 'react'
import {
  ErrorAlert,
  btnLink,
  btnLinkDanger,
  btnPrimary,
  btnSecondary,
  btnSmPrimary,
  btnSmSecondary,
  inputCls,
  parseApiError,
} from '../components/ui.js'
import { useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const COMMON_LOCALES = [
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
]

function CategoryTranslationsSection({ categoryId }: { categoryId: string }) {
  const utils = trpc.useUtils()
  const { data: translations = [] } = trpc.admin.categoryTranslations.list.useQuery({
    categoryId,
  })

  const [editLocale, setEditLocale] = useState<string | null>(null)
  const [locale, setLocale] = useState('fr')
  const [tName, setTName] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const upsertMut = trpc.admin.categoryTranslations.upsert.useMutation({
    onSuccess: () => {
      utils.admin.categoryTranslations.list.invalidate({ categoryId })
      setShowAdd(false)
      setEditLocale(null)
      setTName('')
      setTDesc('')
    },
  })
  const deleteMut = trpc.admin.categoryTranslations.delete.useMutation({
    onSuccess: () => utils.admin.categoryTranslations.list.invalidate({ categoryId }),
  })

  function startEdit(t: { locale: string; name: string; description: string | null }) {
    setEditLocale(t.locale)
    setTName(t.name)
    setTDesc(t.description ?? '')
    setShowAdd(false)
  }

  function startAdd() {
    setEditLocale(null)
    setTName('')
    setTDesc('')
    setShowAdd(true)
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Translations
        </h3>
        {!showAdd && !editLocale && (
          <button type="button" onClick={startAdd} className={btnLink}>
            + Add translation
          </button>
        )}
      </div>

      {translations.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400">No translations yet.</p>
      )}

      {translations.map((t) =>
        editLocale === t.locale ? (
          <form
            key={t.locale}
            onSubmit={(e) => {
              e.preventDefault()
              const opts: Parameters<typeof upsertMut.mutate>[0] = {
                categoryId,
                locale: t.locale,
                name: tName,
              }
              if (tDesc) opts.description = tDesc
              upsertMut.mutate(opts)
            }}
            className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-gray-100"
          >
            <p className="text-xs font-semibold text-indigo-700 uppercase">{t.locale}</p>
            <Field label="Name">
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                value={tDesc}
                onChange={(e) => setTDesc(e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={upsertMut.isPending} className={btnSmPrimary}>
                Save
              </button>
              <button type="button" onClick={() => setEditLocale(null)} className={btnSmSecondary}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div
            key={t.locale}
            className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-100 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{t.locale}</p>
              <p className="text-sm font-medium text-gray-900">{t.name}</p>
            </div>
            <div className="flex gap-2 ml-3 flex-shrink-0">
              <button type="button" onClick={() => startEdit(t)} className={btnLink}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${t.locale} translation?`))
                    deleteMut.mutate({ categoryId, locale: t.locale })
                }}
                className={btnLinkDanger}
              >
                Delete
              </button>
            </div>
          </div>
        ),
      )}

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const opts: Parameters<typeof upsertMut.mutate>[0] = { categoryId, locale, name: tName }
            if (tDesc) opts.description = tDesc
            upsertMut.mutate(opts)
          }}
          className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-gray-100"
        >
          <Field label="Language">
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
              {COMMON_LOCALES.filter((l) => !translations.some((t) => t.locale === l.code)).map(
                (l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Name">
            <input
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={upsertMut.isPending || !tName} className={btnSmPrimary}>
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className={btnSmSecondary}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Unsplash picker (inline) ─────────────────────────────────────────────────
type UnsplashPhoto = {
  id: string
  urls: { thumb: string; small: string; regular: string }
  user: { name: string }
  links: { download_location: string }
}

function UnsplashPicker({
  accessKey,
  onSelect,
  onClose,
}: { accessKey: string; onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnsplashPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape&client_id=${accessKey}`,
      )
      const data = (await res.json()) as { results: UnsplashPhoto[] }
      setResults(data.results ?? [])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  async function pick(photo: UnsplashPhoto) {
    fetch(`${photo.links.download_location}&client_id=${accessKey}`).catch(() => {})
    onSelect(photo.urls.regular)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mt-2 bg-gray-100 shadow-md">
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Search Unsplash…"
          className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-900"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className={btnSmPrimary}
        >
          {loading ? '…' : 'Search'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 px-2">
          ✕
        </button>
      </div>
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
            {results.map((photo) => (
              <img
                key={photo.id}
                src={photo.urls.small}
                alt=""
                onClick={() => void pick(photo)}
                className="w-full aspect-video object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Photos by{' '}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline">
              Unsplash
            </a>
          </p>
        </>
      )}
      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-gray-400 text-center py-4">No results for "{query}"</p>
      )}
      {!searched && !loading && (
        <p className="text-xs text-gray-400 text-center py-3">Type a keyword and press Enter</p>
      )}
    </div>
  )
}

function ImageField({
  value,
  onChange,
  accessKey,
}: { value: string; onChange: (v: string) => void; accessKey: string }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-900"
        />
        {accessKey && (
          <button
            type="button"
            onClick={() => setPickerOpen((p) => !p)}
            className={pickerOpen ? btnSmPrimary : btnSmSecondary}
          >
            🖼 Unsplash
          </button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt=""
          className="mt-2 w-full h-20 object-cover rounded-lg"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      {pickerOpen && accessKey && (
        <UnsplashPicker
          accessKey={accessKey}
          onSelect={(url) => {
            onChange(url)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

export function CategoriesPage() {
  const { t } = useI18n()
  const utils = trpc.useUtils()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const { data: categories = [], isLoading } = trpc.admin.categories.list.useQuery()
  const deleteMut = trpc.admin.categories.delete.useMutation({
    onSuccess: () => void utils.admin.categories.list.invalidate(),
  })

  function invalidate() {
    void utils.admin.categories.list.invalidate()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('categories.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('categories.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true)
            setEditId(null)
          }}
          className={btnPrimary}
        >
          + New category
        </button>
      </div>

      {showCreate && (
        <CategoryForm
          allCategories={categories}
          onSuccess={() => {
            setShowCreate(false)
            invalidate()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">{t('common.loading')}</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-gray-400">{t('categories.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Parent
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Slug
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Banner
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) =>
                editId === cat.id ? (
                  <tr key={cat.id} className="border-b border-gray-50">
                    <td colSpan={5} className="px-5 py-3">
                      <CategoryForm
                        existing={cat}
                        allCategories={categories}
                        onSuccess={() => {
                          setEditId(null)
                          invalidate()
                        }}
                        onCancel={() => setEditId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {cat.parentId && <span className="text-gray-300 mr-1.5">└</span>}
                      {cat.name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm">
                      {cat.parentId ? (
                        (categories.find((c) => c.id === cat.parentId)?.name ?? '—')
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{cat.slug}</td>
                    <td className="px-5 py-3.5">
                      {(cat as CategoryRow).imageUrl ? (
                        <img
                          src={(cat as CategoryRow).imageUrl!}
                          alt=""
                          className="h-8 w-16 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">
                      {cat.description ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-3">
                      <button type="button" onClick={() => setEditId(cat.id)} className={btnLink}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}"?`)) {
                            deleteMut.mutate({ id: cat.id })
                          }
                        }}
                        className={btnLinkDanger}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type CategoryRow = {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
}

function CategoryForm({
  existing,
  allCategories,
  onSuccess,
  onCancel,
}: {
  existing?: CategoryRow
  allCategories: CategoryRow[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const { data: adminConfig } = trpc.admin.config.get.useQuery()
  const unsplashKey =
    ((adminConfig as Record<string, unknown> | undefined)?.unsplashAccessKey as string) ?? ''

  const [name, setName] = useState(existing?.name ?? '')
  const [slug, setSlug] = useState(existing?.slug ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '')
  const [parentId, setParentId] = useState(existing?.parentId ?? '')
  const [error, setError] = useState('')

  const createMut = trpc.admin.categories.create.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })
  const updateMut = trpc.admin.categories.update.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })

  function autoSlug(v: string) {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (existing) {
      updateMut.mutate({
        id: existing.id,
        name,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
        parentId: parentId || undefined,
      })
    } else {
      createMut.mutate({
        name,
        slug,
        description: description || undefined,
        ...(imageUrl ? { imageUrl } : {}),
        parentId: parentId || undefined,
      })
    }
  }

  const busy = createMut.isPending || updateMut.isPending
  const eligibleParents = allCategories.filter((c) => c.id !== existing?.id)

  return (
    <div className="bg-indigo-50 border border-indigo-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm">
        {existing ? 'Edit category' : 'New category'}
      </h2>
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!existing) setSlug(autoSlug(e.target.value))
              }}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Slug *</label>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Parent category</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None (top level) —</option>
              {eligibleParents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ color: '#111' }}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Banner image</label>
          <ImageField value={imageUrl} onChange={setImageUrl} accessKey={unsplashKey} />
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Saving…' : existing ? 'Save' : 'Create'}
          </button>
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
      {existing && <CategoryTranslationsSection categoryId={existing.id} />}
    </div>
  )
}
