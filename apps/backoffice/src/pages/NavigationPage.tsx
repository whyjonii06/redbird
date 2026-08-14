import { useState } from 'react'
import { btnLink, btnLinkDanger, btnPrimary, btnSecondary, inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

// ── Types ────────────────────────────────────────────────────────────────────
type NavType = 'category' | 'page' | 'custom'

type NavItem = {
  id: string
  label: string
  labels?: Record<string, string>
  type: NavType
  value: string
  children?: Omit<NavItem, 'children'>[]
}

// Matches apps/storefront/src/i18n's LOCALES — kept in sync manually since the
// two apps don't share a locale package.
const NAV_LOCALES: { code: string; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9)
}

const TYPE_LABELS: Record<NavType, string> = {
  category: 'Catégorie',
  page: 'Page CMS',
  custom: 'Lien personnalisé',
}

const TYPE_ICON: Record<NavType, string> = {
  category: '📂',
  page: '📄',
  custom: '🔗',
}

// ── Item editor modal ─────────────────────────────────────────────────────────
function ItemForm({
  item,
  categories,
  pages,
  onSave,
  onCancel,
}: {
  item: Partial<NavItem>
  categories: { id: string; name: string; slug: string }[]
  pages: { id: string; title: string; slug: string }[]
  onSave: (item: NavItem) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<NavType>(item.type ?? 'custom')
  const [label, setLabel] = useState(item.label ?? '')
  const [value, setValue] = useState(item.value ?? '')
  const [labels, setLabels] = useState<Record<string, string>>(item.labels ?? {})

  function handleTypeChange(t: NavType) {
    setType(t)
    setValue('')
    if (t === 'category' && categories[0]) {
      const cat = categories[0]
      setValue(`/category/${cat.slug}`)
      if (!label) setLabel(cat.name)
    } else if (t === 'page' && pages[0]) {
      const pg = pages[0]
      setValue(`/pages/${pg.slug}`)
      if (!label) setLabel(pg.title)
    }
  }

  function handleCategoryChange(slug: string) {
    const cat = categories.find((c) => c.slug === slug)
    setValue(`/category/${slug}`)
    if (cat && !label) setLabel(cat.name)
  }

  function handlePageChange(slug: string) {
    const pg = pages.find((p) => p.slug === slug)
    setValue(`/pages/${slug}`)
    if (pg && !label) setLabel(pg.title)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !value.trim()) return
    const cleanLabels = Object.fromEntries(
      Object.entries(labels).filter(([, v]) => v.trim().length > 0),
    )
    onSave({
      id: item.id ?? uid(),
      label: label.trim(),
      ...(Object.keys(cleanLabels).length > 0 ? { labels: cleanLabels } : {}),
      type,
      value: value.trim(),
      ...(item.children ? { children: item.children } : {}),
    })
  }

  const catSlug = value.replace('/category/', '')
  const pageSlug = value.replace('/pages/', '')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">
          {item.id ? 'Modifier le lien' : 'Ajouter un lien'}
        </h2>

        <form onSubmit={submit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Type de lien</label>
            <div className="flex gap-2">
              {(['category', 'page', 'custom'] as NavType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {TYPE_ICON[t]} {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Source picker */}
          {type === 'category' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                value={catSlug}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choisir une catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'page' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Page CMS</label>
              <select
                value={pageSlug}
                onChange={(e) => handlePageChange(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choisir une page —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="/products ou https://…"
                className={inputCls}
                required
              />
            </div>
          )}

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Libellé affiché *
            </label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex : Nouveautés"
              className={inputCls}
            />
          </div>

          {/* Per-locale label overrides */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Traductions du libellé (optionnel)
            </label>
            <div className="space-y-2">
              {NAV_LOCALES.map((l) => (
                <div key={l.code} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 shrink-0 uppercase">{l.code}</span>
                  <input
                    value={labels[l.code] ?? ''}
                    onChange={(e) => setLabels({ ...labels, [l.code]: e.target.value })}
                    placeholder={`${l.label} — laisser vide pour utiliser le libellé par défaut`}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" className={btnPrimary}>
              {item.id ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" onClick={onCancel} className={btnSecondary}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Nav item row ──────────────────────────────────────────────────────────────
function NavRow({
  item,
  index,
  total,
  onEdit,
  onDelete,
  onMove,
  onAddChild,
  onEditChild,
  onDeleteChild,
}: {
  item: NavItem
  index: number
  total: number
  onEdit: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onAddChild: () => void
  onEditChild: (idx: number) => void
  onDeleteChild: (idx: number) => void
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = (item.children?.length ?? 0) > 0

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs"
          >
            ▼
          </button>
        </div>

        {/* Type badge */}
        <span className="text-lg leading-none">{TYPE_ICON[item.type]}</span>

        {/* Label + destination */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{item.label}</span>
          <span className="ml-2 text-xs text-gray-400 font-mono truncate">{item.value}</span>
        </div>

        {/* Type label */}
        <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {TYPE_LABELS[item.type]}
        </span>

        {/* Children toggle */}
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            {open
              ? '▾ Fermer'
              : `▸ ${item.children!.length} sous-lien${item.children!.length > 1 ? 's' : ''}`}
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-2 ml-2">
          <button
            type="button"
            onClick={onAddChild}
            className="text-xs text-gray-400 hover:text-gray-600"
            title="Ajouter un sous-lien"
          >
            + sous-lien
          </button>
          <button type="button" onClick={onEdit} className={btnLink}>
            Modifier
          </button>
          <button type="button" onClick={onDelete} className={btnLinkDanger}>
            Supprimer
          </button>
        </div>
      </div>

      {/* Children */}
      {(open || hasChildren) && (item.children?.length ?? 0) > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
          {item.children!.map((child, ci) => (
            <div key={child.id} className="flex items-center gap-3 px-4 py-2 pl-10">
              <span className="text-base leading-none">{TYPE_ICON[child.type]}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800">{child.label}</span>
                <span className="ml-2 text-xs text-gray-400 font-mono">{child.value}</span>
              </div>
              <button type="button" onClick={() => onEditChild(ci)} className={btnLink}>
                Modifier
              </button>
              <button type="button" onClick={() => onDeleteChild(ci)} className={btnLinkDanger}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function NavigationPage() {
  const utils = trpc.useUtils()
  const { data: items = [], isLoading } = trpc.admin.navigation.get.useQuery()
  const { data: categoriesData = [] } = trpc.admin.categories.list.useQuery()
  const { data: cmsPages = [] } = trpc.admin.cms.list.useQuery()

  const [localItems, setLocalItems] = useState<NavItem[] | null>(null)
  const [modal, setModal] = useState<{
    item: Partial<NavItem>
    parentId?: string
    childIdx?: number
  } | null>(null)
  const [saved, setSaved] = useState(false)

  const saveMut = trpc.admin.navigation.set.useMutation({
    onSuccess: () => {
      void utils.admin.navigation.get.invalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const displayed = localItems ?? (items as NavItem[])

  function update(next: NavItem[]) {
    setLocalItems(next)
    setSaved(false)
  }

  function addItem(item: NavItem) {
    if (modal?.parentId) {
      update(
        displayed.map((it) =>
          it.id === modal.parentId ? { ...it, children: [...(it.children ?? []), item] } : it,
        ),
      )
    } else {
      update([...displayed, item])
    }
    setModal(null)
  }

  function editItem(item: NavItem) {
    if (modal?.parentId !== undefined && modal.childIdx !== undefined) {
      update(
        displayed.map((it) =>
          it.id === modal.parentId
            ? {
                ...it,
                children: it.children?.map((c, i) => (i === modal.childIdx ? item : c)) ?? [],
              }
            : it,
        ),
      )
    } else {
      update(displayed.map((it) => (it.id === item.id ? item : it)))
    }
    setModal(null)
  }

  function deleteItem(id: string) {
    update(displayed.filter((it) => it.id !== id))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...displayed]
    const [removed] = next.splice(index, 1)
    next.splice(index + dir, 0, removed)
    update(next)
  }

  function deleteChild(parentId: string, ci: number) {
    update(
      displayed.map((it) =>
        it.id === parentId
          ? { ...it, children: it.children?.filter((_, i) => i !== ci) ?? [] }
          : it,
      ),
    )
  }

  const categories = categoriesData.map((c: { id: string; name: string; slug: string }) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }))
  const pages = (cmsPages as { id: string; title: string; slug: string }[]).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
  }))

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Menu de navigation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Liens affichés dans l'en-tête du site</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setModal({ item: {} })} className={btnPrimary}>
            + Ajouter un lien
          </button>
          {localItems !== null && (
            <button
              type="button"
              onClick={() => saveMut.mutate(displayed)}
              disabled={saveMut.isPending}
              className={btnPrimary}
            >
              {saveMut.isPending ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Chargement…</div>
      ) : displayed.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center text-gray-400">
          <p className="text-3xl mb-3">🧭</p>
          <p className="text-sm">Aucun lien dans le menu.</p>
          <button
            type="button"
            onClick={() => setModal({ item: {} })}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            Ajouter votre premier lien
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((item, i) => (
            <NavRow
              key={item.id}
              item={item}
              index={i}
              total={displayed.length}
              onEdit={() => setModal({ item })}
              onDelete={() => deleteItem(item.id)}
              onMove={(dir) => move(i, dir)}
              onAddChild={() => setModal({ item: {}, parentId: item.id })}
              onEditChild={(ci) =>
                setModal({ item: item.children![ci], parentId: item.id, childIdx: ci })
              }
              onDeleteChild={(ci) => deleteChild(item.id, ci)}
            />
          ))}
        </div>
      )}

      {localItems !== null && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
          Modifications non enregistrées — cliquez sur "Enregistrer" pour appliquer.
        </p>
      )}

      {modal && (
        <ItemForm
          item={modal.item}
          categories={categories}
          pages={pages}
          onSave={modal.item.id ? editItem : addItem}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
