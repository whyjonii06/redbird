import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { btnLink, btnLinkDanger, btnPrimary, inputCls } from '../components/ui.js'
import { fmt, trpc } from '../trpc.js'

type Status = 'draft' | 'active' | 'archived'

export function ProductFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: product } = trpc.admin.catalog.list.useQuery(
    { limit: 1, offset: 0 },
    { enabled: false },
  )
  void product

  // For edit mode, fetch the product via catalog list then filter — or use byId via checkout router
  const { data: allProducts } = trpc.admin.catalog.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: isEdit },
  )
  const existing = isEdit ? allProducts?.find((p) => p.id === id) : undefined

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('draft')
  const [brandId, setBrandId] = useState<string>('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [taxRate, setTaxRate] = useState('') // VAT rate in percent (e.g. "20", "5.5")

  const { data: brands = [] } = trpc.brands.list.useQuery()

  // Variant form (for new product)
  const [variantSku, setVariantSku] = useState('')
  const [variantName, setVariantName] = useState('')
  const [variantPrice, setVariantPrice] = useState('')
  const [variantCurrency, setVariantCurrency] = useState('EUR')

  // Add variant to existing product
  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setSlug(existing.slug)
      setDescription(existing.description ?? '')
      setStatus(existing.status)
      setBrandId(existing.brandId ?? '')
      setIsVirtual(existing.isVirtual)
      setMetaTitle(existing.metaTitle ?? '')
      setMetaDescription(existing.metaDescription ?? '')
      setTaxRate(existing.taxRateBp != null ? String(existing.taxRateBp / 100) : '')
    }
  }, [existing])

  const taxRateBp = taxRate.trim() ? Math.round(Number.parseFloat(taxRate) * 100) : null

  const createProduct = trpc.admin.catalog.create.useMutation({
    onSuccess: () => {
      utils.admin.catalog.list.invalidate()
      navigate('/products')
    },
  })
  const updateProduct = trpc.admin.catalog.update.useMutation({
    onSuccess: () => utils.admin.catalog.list.invalidate(),
  })
  function autoSlug(v: string) {
    return v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit && id) {
      updateProduct.mutate({
        id,
        name,
        slug,
        description: description || null,
        status,
        brandId: brandId || null,
        isVirtual,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        taxRateBp,
      })
    } else {
      const priceAmountCents = Math.round(Number.parseFloat(variantPrice) * 100)
      createProduct.mutate({
        name,
        slug,
        description: description || undefined,
        status,
        taxRateBp,
        variant: {
          sku: variantSku,
          name: variantName,
          priceAmount: priceAmountCents,
          priceCurrency: variantCurrency,
        },
      })
    }
  }

  const busy = createProduct.isPending || updateProduct.isPending

  return (
    <div className="p-8 space-y-6">
      <Link to="/products" className="text-sm text-indigo-600 hover:underline">
        ← Back to products
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit product' : 'New product'}
        </h1>
      </div>

      {/* Product form */}
      <form onSubmit={handleSubmit} className="bg-gray-100 border border-gray-200 p-6 space-y-4">
        <Field label="Name" required>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!isEdit) setSlug(autoSlug(e.target.value))
            }}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Slug" required>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className={inputCls}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field label="VAT rate (%)">
          <input
            type="number"
            step="0.1"
            min="0"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            placeholder="e.g. 20 or 5.5 — leave empty for the store default"
            className={inputCls}
          />
        </Field>
        {brands.length > 0 && (
          <Field label="Brand">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={inputCls}
            >
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex items-center gap-3 pt-1">
          <input
            id="is-virtual"
            type="checkbox"
            checked={isVirtual}
            onChange={(e) => setIsVirtual(e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          <label htmlFor="is-virtual" className="text-sm font-medium text-gray-700 cursor-pointer">
            Virtual product{' '}
            <span className="font-normal text-gray-400">(no shipping, downloadable)</span>
          </label>
        </div>

        {/* SEO */}
        {isEdit && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">SEO</p>
            <Field label="Meta title">
              <input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className={inputCls}
                placeholder="Overrides page title in search results"
              />
            </Field>
            <Field label="Meta description">
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Short description for search results (150 chars)"
                maxLength={160}
              />
            </Field>
          </div>
        )}

        {/* Variant section — only for new products */}
        {!isEdit && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Initial variant</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU" required>
                <input
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Variant name" required>
                <input
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className={inputCls}
                  required
                  placeholder="e.g. Default"
                />
              </Field>
              <Field label="Price" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value)}
                  className={inputCls}
                  required
                  placeholder="0.00"
                />
              </Field>
              <Field label="Currency">
                <input
                  value={variantCurrency}
                  onChange={(e) => setVariantCurrency(e.target.value.toUpperCase())}
                  className={inputCls}
                  maxLength={3}
                />
              </Field>
            </div>
          </div>
        )}

        {createProduct.error && (
          <p className="text-sm text-red-500">{createProduct.error.message}</p>
        )}
        {updateProduct.error && (
          <p className="text-sm text-red-500">{updateProduct.error.message}</p>
        )}
        {updateProduct.isSuccess && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {isEdit ? 'Save changes' : 'Create product'}
        </button>
      </form>

      {/* Variants list + add variant (edit mode only) */}
      {isEdit && id && (
        <VariantsSection
          productId={id}
          variants={existing?.variants ?? []}
          onUpdate={() => utils.admin.catalog.list.invalidate()}
        />
      )}

      {/* Attribute combinations */}
      {isEdit && id && (
        <AttributesSection productId={id} existingVariants={existing?.variants ?? []} />
      )}

      {/* Images */}
      {isEdit && id && <ImagesSection productId={id} />}

      {/* Downloadable files */}
      {isEdit && id && isVirtual && <DownloadsSection productId={id} />}

      {/* Product features */}
      {isEdit && id && <FeaturesSection productId={id} />}

      {/* Categories */}
      {isEdit && id && <CategoriesSection productId={id} />}

      {/* Translations */}
      {isEdit && id && <TranslationsSection productId={id} />}

      {/* Related products */}
      {isEdit && id && <RelatedProductsSection productId={id} />}
    </div>
  )
}

function AttributesSection({
  productId,
  existingVariants,
}: {
  productId: string
  existingVariants: Array<{ priceAmount: number; priceCurrency: string }>
}) {
  const utils = trpc.useUtils()
  const [newAttr, setNewAttr] = useState('')
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const [genPrice, setGenPrice] = useState('')
  const [genCurrency, setGenCurrency] = useState('EUR')

  const { data: attrs = [] } = trpc.attributes.list.useQuery({ productId })
  const addAttrMut = trpc.attributes.addAttribute.useMutation({
    onSuccess: () => {
      utils.attributes.list.invalidate()
      setNewAttr('')
    },
  })
  const addValMut = trpc.attributes.addValue.useMutation({
    onSuccess: () => utils.attributes.list.invalidate(),
  })
  const removeAttrMut = trpc.attributes.removeAttribute.useMutation({
    onSuccess: () => utils.attributes.list.invalidate(),
  })
  const removeValMut = trpc.attributes.removeValue.useMutation({
    onSuccess: () => utils.attributes.list.invalidate(),
  })
  const genMut = trpc.attributes.generateCombinations.useMutation({
    onSuccess: () => utils.admin.catalog.list.invalidate(),
  })

  const basePrice = existingVariants[0] ? existingVariants[0].priceAmount / 100 : 0
  const baseCurrency = existingVariants[0]?.priceCurrency ?? 'EUR'

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Attribute combinations</h2>
      <p className="text-xs text-gray-500">
        Add attributes (e.g. Color, Size) then auto-generate all variant combinations.
      </p>

      {/* Existing attributes */}
      {attrs.map((attr) => (
        <div key={attr.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{attr.name}</p>
            <button
              type="button"
              onClick={() => removeAttrMut.mutate({ id: attr.id })}
              className={btnLinkDanger}
            >
              Remove
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attr.values.map((v) => (
              <span
                key={v.id}
                className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs font-medium"
              >
                {v.value}
                <button
                  type="button"
                  onClick={() => removeValMut.mutate({ id: v.id })}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const val = newValues[attr.id] ?? ''
              if (val) {
                addValMut.mutate({ attributeId: attr.id, value: val })
                setNewValues((v) => ({ ...v, [attr.id]: '' }))
              }
            }}
            className="flex gap-2"
          >
            <input
              value={newValues[attr.id] ?? ''}
              onChange={(e) => setNewValues((v) => ({ ...v, [attr.id]: e.target.value }))}
              placeholder="Add value…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200"
            >
              Add
            </button>
          </form>
        </div>
      ))}

      {/* Add attribute */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newAttr) addAttrMut.mutate({ productId, name: newAttr })
        }}
        className="flex gap-2"
      >
        <input
          value={newAttr}
          onChange={(e) => setNewAttr(e.target.value)}
          placeholder="New attribute (e.g. Color)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!newAttr || addAttrMut.isPending}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Generate combinations */}
      {attrs.length > 0 && attrs.some((a) => a.values.length > 0) && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Generate variants
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Base price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={genPrice || basePrice.toString()}
                onChange={(e) => setGenPrice(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-600 mb-1">Currency</label>
              <input
                value={genCurrency || baseCurrency}
                onChange={(e) => setGenCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                genMut.mutate({
                  productId,
                  priceAmount: Math.round(
                    Number.parseFloat(genPrice || basePrice.toString()) * 100,
                  ),
                  priceCurrency: genCurrency || baseCurrency,
                })
              }
              disabled={genMut.isPending}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              {genMut.isPending ? 'Generating…' : 'Generate combinations'}
            </button>
          </div>
          {genMut.isSuccess && (
            <p className="text-xs text-green-600">
              Created {genMut.data.created} variant{genMut.data.created !== 1 ? 's' : ''}
              {genMut.data.skipped > 0 ? `, ${genMut.data.skipped} already existed` : ''}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type VariantRow = {
  id: string
  name: string
  sku: string
  priceAmount: number
  priceCurrency: string
  stockLevel: { available: number; reserved: number; committed: number } | null
}

function VariantsSection({
  productId,
  variants,
  onUpdate,
}: {
  productId: string
  variants: VariantRow[]
  onUpdate: () => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [addSku, setAddSku] = useState('')
  const [addName, setAddName] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addCurrency, setAddCurrency] = useState('EUR')

  const addMut = trpc.admin.catalog.addVariant.useMutation({
    onSuccess: () => {
      onUpdate()
      setAddSku('')
      setAddName('')
      setAddPrice('')
    },
  })
  const deleteMut = trpc.admin.catalog.deleteVariant.useMutation({
    onSuccess: () => onUpdate(),
  })

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Variants</h2>

      <div className="space-y-2">
        {variants.map((v) =>
          editId === v.id ? (
            <VariantEditRow
              key={v.id}
              variant={v}
              onDone={() => {
                setEditId(null)
                onUpdate()
              }}
            />
          ) : (
            <div
              key={v.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{v.name}</p>
                <p className="text-xs text-gray-400 font-mono">{v.sku}</p>
              </div>
              <div className="text-sm font-semibold text-gray-800 w-24 text-right">
                {fmt(v.priceAmount, v.priceCurrency)}
              </div>
              <StockCell variantId={v.id} stockLevel={v.stockLevel} />
              <div className="flex gap-2 ml-2">
                <button type="button" onClick={() => setEditId(v.id)} className={btnLink}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete variant "${v.name}"?`)) deleteMut.mutate({ id: v.id })
                  }}
                  className={btnLinkDanger}
                >
                  Delete
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addMut.mutate({
            productId,
            sku: addSku,
            name: addName,
            priceAmount: Math.round(Number.parseFloat(addPrice) * 100),
            priceCurrency: addCurrency,
          })
        }}
        className="border-t border-gray-100 pt-4 space-y-3"
      >
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add variant</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input
              value={addSku}
              onChange={(e) => setAddSku(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Name">
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Price">
            <input
              type="number"
              step="0.01"
              min="0"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              className={inputCls}
              required
              placeholder="0.00"
            />
          </Field>
          <Field label="Currency">
            <input
              value={addCurrency}
              onChange={(e) => setAddCurrency(e.target.value.toUpperCase())}
              className={inputCls}
              maxLength={3}
            />
          </Field>
        </div>
        <button type="submit" disabled={addMut.isPending} className={btnPrimary}>
          Add variant
        </button>
      </form>
    </div>
  )
}

function StockCell({
  variantId,
  stockLevel,
}: { variantId: string; stockLevel: { available: number } | null }) {
  const utils = trpc.useUtils()
  const [qty, setQty] = useState('')
  const [mode, setMode] = useState<'set' | 'adjust'>('set')
  const [open, setOpen] = useState(false)

  const setMut = trpc.admin.stock.set.useMutation({
    onSuccess: () => {
      utils.admin.catalog.list.invalidate()
      setOpen(false)
    },
  })
  const adjustMut = trpc.admin.stock.adjust.useMutation({
    onSuccess: () => {
      utils.admin.catalog.list.invalidate()
      setOpen(false)
    },
  })

  const available = stockLevel?.available ?? null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs px-2 py-1 rounded-full ${available === null ? 'bg-gray-100 text-gray-500' : available === 0 ? 'bg-red-100 text-red-600' : available <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}
      >
        {available === null ? 'Unlimited' : `${available} in stock`}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 bg-gray-100 border border-gray-200 rounded-xl shadow-lg p-4 w-52 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Update stock</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`flex-1 text-xs px-2 py-1 rounded-lg ${mode === 'set' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Set
            </button>
            <button
              type="button"
              onClick={() => setMode('adjust')}
              className={`flex-1 text-xs px-2 py-1 rounded-lg ${mode === 'adjust' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Adjust ±
            </button>
          </div>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={mode === 'set' ? 'Quantity' : '+5 or -3'}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const n = Number.parseInt(qty, 10)
                if (Number.isNaN(n)) return
                if (mode === 'set') setMut.mutate({ variantId, quantity: Math.max(0, n) })
                else adjustMut.mutate({ variantId, delta: n })
                setQty('')
              }}
              disabled={setMut.isPending || adjustMut.isPending}
              className="flex-1 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function VariantEditRow({ variant, onDone }: { variant: VariantRow; onDone: () => void }) {
  const [sku, setSku] = useState(variant.sku)
  const [name, setName] = useState(variant.name)
  const [price, setPrice] = useState((variant.priceAmount / 100).toFixed(2))
  const [currency, setCurrency] = useState(variant.priceCurrency)

  const updateMut = trpc.admin.catalog.updateVariant.useMutation({ onSuccess: onDone })

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Currency</label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            updateMut.mutate({
              id: variant.id,
              sku,
              name,
              priceAmount: Math.round(Number.parseFloat(price) * 100),
              priceCurrency: currency,
            })
          }
          disabled={updateMut.isPending}
          className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function DownloadsSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()
  const [filename, setFilename] = useState('')
  const [url, setUrl] = useState('')

  const { data: files = [] } = trpc.admin.downloads.list.useQuery({ productId })
  const addMut = trpc.admin.downloads.add.useMutation({
    onSuccess() {
      void utils.admin.downloads.list.invalidate({ productId })
      setFilename('')
      setUrl('')
    },
  })
  const removeMut = trpc.admin.downloads.remove.useMutation({
    onSuccess: () => void utils.admin.downloads.list.invalidate({ productId }),
  })

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Downloadable files</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Files are delivered to customers as download links after payment.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.filename}</p>
                <p className="text-xs text-gray-400 truncate">{f.url}</p>
              </div>
              {f.fileSize && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {(f.fileSize / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove "${f.filename}"?`)) removeMut.mutate({ id: f.id })
                }}
                className="text-xs text-red-400 hover:text-red-600 whitespace-nowrap"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (filename && url) addMut.mutate({ productId, filename, url })
        }}
        className="border-t border-gray-100 pt-4 space-y-3"
      >
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add file</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Filename" required>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="ebook.pdf"
              className={inputCls}
              required
            />
          </Field>
          <Field label="File URL" required>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
              required
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={addMut.isPending || !filename || !url}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {addMut.isPending ? 'Adding…' : 'Add file'}
        </button>
        {addMut.error && <p className="text-xs text-red-500">{addMut.error.message}</p>}
      </form>
    </div>
  )
}

function Field({
  label,
  children,
  required,
}: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ImagesSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const { data: images = [] } = trpc.admin.images.list.useQuery({ productId })
  const addMut = trpc.admin.images.add.useMutation({
    onSuccess: () => {
      utils.admin.images.list.invalidate()
      setUrl('')
      setAlt('')
    },
  })
  const deleteMut = trpc.admin.images.delete.useMutation({
    onSuccess: () => void utils.admin.images.list.invalidate(),
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const data = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const apiBase =
        (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'
      const resp = await fetch(`${apiBase}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data }),
      })
      if (!resp.ok) throw new Error('Upload failed')
      const { url: uploaded } = (await resp.json()) as { url: string }
      addMut.mutate({ productId, url: `${apiBase}${uploaded}`, alt: alt || undefined })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Images</h2>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.alt ?? ''}
                className="w-24 h-24 rounded-lg object-cover border border-gray-100"
              />
              <button
                type="button"
                onClick={() => deleteMut.mutate({ id: img.id })}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
              <p className="text-xs text-center text-gray-400 mt-1">#{img.position}</p>
            </div>
          ))}
        </div>
      )}

      {/* File upload */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Upload image</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              onChange={(e) => void handleFileChange(e)}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-gray-600 mb-1">Alt text</label>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {uploading && <p className="text-xs text-indigo-600 self-end pb-2">Uploading…</p>}
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* URL fallback */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (url) addMut.mutate({ productId, url, alt: alt || undefined })
        }}
        className="flex gap-3 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Or paste image URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" disabled={addMut.isPending || !url} className={btnPrimary}>
          Add URL
        </button>
      </form>
    </div>
  )
}

function CategoriesSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()

  const { data: allCats = [] } = trpc.admin.categories.list.useQuery()
  const { data: assignedCats = [] } = trpc.admin.categories.forProduct.useQuery({ productId })

  const assignMut = trpc.admin.categories.assignProduct.useMutation({
    onSuccess: () => void utils.admin.categories.forProduct.invalidate({ productId }),
  })
  const unassignMut = trpc.admin.categories.unassignProduct.useMutation({
    onSuccess: () => void utils.admin.categories.forProduct.invalidate({ productId }),
  })

  if (allCats.length === 0) return null

  const assignedIds = new Set(assignedCats.map((c) => c.id))

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Categories</h2>
      <p className="text-xs text-gray-500">Click to toggle category assignment.</p>
      <div className="flex flex-wrap gap-2">
        {allCats.map((cat) => {
          const assigned = assignedIds.has(cat.id)
          return (
            <button
              type="button"
              key={cat.id}
              onClick={() => {
                if (assigned) {
                  unassignMut.mutate({ productId, categoryId: cat.id })
                } else {
                  assignMut.mutate({ productId, categoryId: cat.id })
                }
              }}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                assigned
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-indigo-400'
              }`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>
      {(assignMut.error ?? unassignMut.error) && (
        <p className="text-xs text-red-500">
          {assignMut.error?.message ?? unassignMut.error?.message}
        </p>
      )}
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

function TranslationsSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()
  const { data: translations = [] } = trpc.admin.translations.list.useQuery({ productId })

  const [editLocale, setEditLocale] = useState<string | null>(null)
  const [locale, setLocale] = useState('fr')
  const [tName, setTName] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const upsertMut = trpc.admin.translations.upsert.useMutation({
    onSuccess: () => {
      utils.admin.translations.list.invalidate({ productId })
      setShowAdd(false)
      setEditLocale(null)
      setTName('')
      setTDesc('')
    },
  })
  const deleteMut = trpc.admin.translations.delete.useMutation({
    onSuccess: () => utils.admin.translations.list.invalidate({ productId }),
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
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Translations</h2>
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
                productId,
                locale: t.locale,
                name: tName,
              }
              if (tDesc) opts.description = tDesc
              upsertMut.mutate(opts)
            }}
            className="border border-indigo-200 rounded-xl p-4 space-y-3"
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
              <button
                type="submit"
                disabled={upsertMut.isPending}
                className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditLocale(null)}
                className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div
            key={t.locale}
            className="flex items-start justify-between rounded-lg border border-gray-100 px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t.locale}</p>
              <p className="text-sm font-medium text-gray-900">{t.name}</p>
              {t.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
              )}
            </div>
            <div className="flex gap-2 ml-3 flex-shrink-0">
              <button type="button" onClick={() => startEdit(t)} className={btnLink}>
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${t.locale} translation?`))
                    deleteMut.mutate({ productId, locale: t.locale })
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
            const opts: Parameters<typeof upsertMut.mutate>[0] = { productId, locale, name: tName }
            if (tDesc) opts.description = tDesc
            upsertMut.mutate(opts)
          }}
          className="border border-indigo-200 rounded-xl p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            New translation
          </p>
          <Field label="Language">
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
              {COMMON_LOCALES.filter((l) => !translations.some((t) => t.locale === l.code)).map(
                (l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ),
              )}
              <option value="custom">Custom locale…</option>
            </select>
            {locale === 'custom' && (
              <input
                placeholder="e.g. pt-BR"
                className={`${inputCls} mt-2`}
                onChange={(e) => setLocale(e.target.value.toLowerCase())}
              />
            )}
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
            <button
              type="submit"
              disabled={upsertMut.isPending || !tName}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function RelatedProductsSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()
  const [searchQuery, setSearchQuery] = useState('')
  const [relType, setRelType] = useState<'related' | 'upsell' | 'cross_sell'>('related')

  const { data: relations = [], isLoading } = trpc.admin.catalog.listRelations.useQuery({
    productId,
  })

  const { data: allProducts = [] } = trpc.admin.catalog.list.useQuery({ limit: 100 })

  const addMut = trpc.admin.catalog.addRelation.useMutation({
    onSuccess: () => utils.admin.catalog.listRelations.invalidate({ productId }),
  })
  const removeMut = trpc.admin.catalog.removeRelation.useMutation({
    onSuccess: () => utils.admin.catalog.listRelations.invalidate({ productId }),
  })

  const relatedIds = new Set(relations.map((r) => r.relatedProductId))
  const candidates = allProducts.filter((p) => p.id !== productId && !relatedIds.has(p.id))
  const filtered = searchQuery
    ? candidates.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : candidates

  return (
    <div className="bg-gray-100 border border-gray-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Related products</h2>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : relations.length === 0 ? (
        <p className="text-sm text-gray-400">No related products yet.</p>
      ) : (
        <div className="space-y-2">
          {relations.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3">
                {rel.relatedProduct?.images[0] && (
                  <img
                    src={rel.relatedProduct.images[0].url}
                    alt=""
                    className="w-8 h-8 rounded object-cover bg-gray-100"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {rel.relatedProduct?.name ?? rel.relatedProductId}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{rel.type.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeMut.mutate({ id: rel.id })}
                disabled={removeMut.isPending}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add product</p>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={relType}
            onChange={(e) => setRelType(e.target.value as typeof relType)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none"
          >
            <option value="related">Related</option>
            <option value="upsell">Upsell</option>
            <option value="cross_sell">Cross-sell</option>
          </select>
        </div>
        {searchQuery && (
          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 p-3">No matching products.</p>
            ) : (
              filtered.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    addMut.mutate({ productId, relatedProductId: p.id, type: relType })
                    setSearchQuery('')
                  }}
                  disabled={addMut.isPending}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  {p.images[0] && (
                    <img
                      src={p.images[0].url}
                      alt=""
                      className="w-7 h-7 rounded object-cover bg-gray-100 flex-shrink-0"
                    />
                  )}
                  <span className="text-sm text-gray-800">{p.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FeaturesSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils()
  const { data: features = [] } = trpc.admin.catalog.listFeatures.useQuery({ productId })

  const addMut = trpc.admin.catalog.addFeature.useMutation({
    onSuccess: () => void utils.admin.catalog.listFeatures.invalidate({ productId }),
  })
  const updateMut = trpc.admin.catalog.updateFeature.useMutation({
    onSuccess: () => void utils.admin.catalog.listFeatures.invalidate({ productId }),
  })
  const removeMut = trpc.admin.catalog.removeFeature.useMutation({
    onSuccess: () => void utils.admin.catalog.listFeatures.invalidate({ productId }),
  })

  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')

  function startEdit(f: { id: string; name: string; value: string }) {
    setEditId(f.id)
    setEditName(f.name)
    setEditValue(f.value)
  }

  return (
    <div className="bg-gray-100 border border-gray-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Product features</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Fixed product characteristics (e.g. Material: Cotton, Made in: France)
        </p>
      </div>

      {features.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase">
                Feature
              </th>
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase">
                Value
              </th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {features.map((f) =>
              editId === f.id ? (
                <tr key={f.id} className="border-b border-gray-50">
                  <td className="py-2 pr-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (editName && editValue)
                          updateMut.mutate({ id: f.id, name: editName, value: editValue })
                        setEditId(null)
                      }}
                      className={btnLink}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-600 font-medium">{f.name}</td>
                  <td className="py-2.5 text-gray-700">{f.value}</td>
                  <td className="py-2.5 text-right space-x-2">
                    <button type="button" onClick={() => startEdit(f)} className={btnLink}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMut.mutate({ id: f.id })}
                      className={btnLinkDanger}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newName && newValue) {
            addMut.mutate({ productId, name: newName, value: newValue, position: features.length })
            setNewName('')
            setNewValue('')
          }
        }}
        className="flex gap-2 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Feature name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Material"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">Value</label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="100% Cotton"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!newName || !newValue || addMut.isPending}
          className={btnPrimary}
        >
          Add
        </button>
      </form>
    </div>
  )
}
