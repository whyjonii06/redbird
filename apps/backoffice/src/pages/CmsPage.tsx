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

function CmsTranslationsSection({ pageId }: { pageId: string }) {
  const utils = trpc.useUtils()
  const { data: translations = [] } = trpc.admin.cmsTranslations.list.useQuery({ pageId })

  const [editLocale, setEditLocale] = useState<string | null>(null)
  const [locale, setLocale] = useState('fr')
  const [tTitle, setTTitle] = useState('')
  const [tExcerpt, setTExcerpt] = useState('')
  const [tContent, setTContent] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const upsertMut = trpc.admin.cmsTranslations.upsert.useMutation({
    onSuccess: () => {
      utils.admin.cmsTranslations.list.invalidate({ pageId })
      setShowAdd(false)
      setEditLocale(null)
      setTTitle('')
      setTExcerpt('')
      setTContent('')
    },
  })
  const deleteMut = trpc.admin.cmsTranslations.delete.useMutation({
    onSuccess: () => utils.admin.cmsTranslations.list.invalidate({ pageId }),
  })

  function startEdit(t: {
    locale: string
    title: string
    excerpt: string | null
    content: string
  }) {
    setEditLocale(t.locale)
    setTTitle(t.title)
    setTExcerpt(t.excerpt ?? '')
    setTContent(t.content)
    setShowAdd(false)
  }

  function startAdd() {
    setEditLocale(null)
    setTTitle('')
    setTExcerpt('')
    setTContent('')
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
                pageId,
                locale: t.locale,
                title: tTitle,
                content: tContent,
              }
              if (tExcerpt) opts.excerpt = tExcerpt
              upsertMut.mutate(opts)
            }}
            className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-white"
          >
            <p className="text-xs font-semibold text-indigo-700 uppercase">{t.locale}</p>
            <Field label="Title">
              <input
                value={tTitle}
                onChange={(e) => setTTitle(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Excerpt">
              <input
                value={tExcerpt}
                onChange={(e) => setTExcerpt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Content">
              <textarea
                value={tContent}
                onChange={(e) => setTContent(e.target.value)}
                rows={6}
                className={inputCls}
                required
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
            className="flex items-start justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{t.locale}</p>
              <p className="text-sm font-medium text-gray-900">{t.title}</p>
            </div>
            <div className="flex gap-2 ml-3 flex-shrink-0">
              <button type="button" onClick={() => startEdit(t)} className={btnLink}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${t.locale} translation?`))
                    deleteMut.mutate({ pageId, locale: t.locale })
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
            const opts: Parameters<typeof upsertMut.mutate>[0] = {
              pageId,
              locale,
              title: tTitle,
              content: tContent,
            }
            if (tExcerpt) opts.excerpt = tExcerpt
            upsertMut.mutate(opts)
          }}
          className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-white"
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
          <Field label="Title">
            <input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Excerpt">
            <input
              value={tExcerpt}
              onChange={(e) => setTExcerpt(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Content">
            <textarea
              value={tContent}
              onChange={(e) => setTContent(e.target.value)}
              rows={6}
              className={inputCls}
              required
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={upsertMut.isPending || !tTitle || !tContent}
              className={btnSmPrimary}
            >
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

export function CmsPage() {
  const utils = trpc.useUtils()
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const { data: pages = [], isLoading } = trpc.admin.cms.list.useQuery()
  const deleteMut = trpc.admin.cms.delete.useMutation({
    onSuccess: () => void utils.admin.cms.list.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">CMS Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Static pages like About, Contact, Terms…</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true)
            setEditId(null)
          }}
          className={btnPrimary}
        >
          + New page
        </button>
      </div>

      {showCreate && (
        <CmsForm
          onSuccess={() => {
            setShowCreate(false)
            void utils.admin.cms.list.invalidate()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : pages.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No pages yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Slug
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) =>
                editId === page.id ? (
                  <tr key={page.id} className="border-b border-gray-50">
                    <td colSpan={4} className="px-5 py-3">
                      <CmsForm
                        existing={page}
                        onSuccess={() => {
                          setEditId(null)
                          void utils.admin.cms.list.invalidate()
                        }}
                        onCancel={() => setEditId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={page.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{page.title}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">
                      /pages/{page.slug}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${page.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {page.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-3">
                      <button type="button" onClick={() => setEditId(page.id)} className={btnLink}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${page.title}"?`)) deleteMut.mutate({ id: page.id })
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

type PageRow = {
  id: string
  slug: string
  title: string
  content: string
  excerpt?: string | null
  published: boolean
  position: number
}

function CmsForm({
  existing,
  onSuccess,
  onCancel,
}: { existing?: PageRow; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [slug, setSlug] = useState(existing?.slug ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? '')
  const [published, setPublished] = useState(existing?.published ?? false)
  const [error, setError] = useState('')

  const createMut = trpc.admin.cms.create.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })
  const updateMut = trpc.admin.cms.update.useMutation({
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
        title,
        slug,
        content,
        excerpt: excerpt || undefined,
        published,
      })
    } else {
      createMut.mutate({ title, slug, content, excerpt: excerpt || undefined, published })
    }
  }

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div className="bg-indigo-50 border border-indigo-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm">{existing ? 'Edit page' : 'New page'}</h2>
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
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
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Excerpt</label>
            <input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short description shown in footer/listings"
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className={inputCls}
              placeholder="Supports plain text or basic HTML"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="published" className="text-sm text-gray-700">
              Published (visible on storefront)
            </label>
          </div>
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
      {existing && <CmsTranslationsSection pageId={existing.id} />}
    </div>
  )
}
