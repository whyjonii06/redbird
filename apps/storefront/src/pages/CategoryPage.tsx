import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../App.js'
import { FilterPanel } from '../components/FilterPanel.js'
import { ProductCard } from '../components/ProductCard.js'
import { trpc } from '../trpc.js'

const LIMIT = 12
type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'name'

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const meta = useMeta()
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [attributeValueIds, setAttributeValueIds] = useState<string[]>([])
  const [minPriceCents, setMinPriceCents] = useState<number | undefined>()
  const [maxPriceCents, setMaxPriceCents] = useState<number | undefined>()
  const [inStock, setInStock] = useState(false)

  const { data: category, isLoading: catLoading } = trpc.categories.bySlug.useQuery(
    { slug: slug! },
    { enabled: Boolean(slug) },
  )

  const { data, isLoading, isFetching } = trpc.catalog.filter.useQuery(
    {
      categoryId: category?.id ?? '',
      limit: LIMIT,
      offset,
      sortBy,
      brandIds: brandIds.length ? brandIds : undefined,
      attributeValueIds: attributeValueIds.length ? attributeValueIds : undefined,
      minPrice: minPriceCents,
      maxPrice: maxPriceCents,
      inStock: inStock || undefined,
    },
    { enabled: Boolean(category?.id) },
  )

  useEffect(() => {
    if (!category) return
    document.title = `${category.name} — ${meta.storeName}`
  }, [category, meta.storeName])

  const products = data?.products ?? []
  const totalCount = data?.totalCount ?? 0
  const facets = data?.facets

  const hasPrev = offset > 0
  const hasNext = offset + LIMIT < totalCount

  function reset() {
    setBrandIds([])
    setAttributeValueIds([])
    setMinPriceCents(undefined)
    setMaxPriceCents(undefined)
    setInStock(false)
    setOffset(0)
  }

  function handleBrandToggle(id: string) {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
    setOffset(0)
  }

  function handleAttributeToggle(valueId: string) {
    setAttributeValueIds((prev) =>
      prev.includes(valueId) ? prev.filter((id) => id !== valueId) : [...prev, valueId],
    )
    setOffset(0)
  }

  function handlePriceApply(min: number | undefined, max: number | undefined) {
    setMinPriceCents(min)
    setMaxPriceCents(max)
    setOffset(0)
  }

  function handleInStock(v: boolean) {
    setInStock(v)
    setOffset(0)
  }

  if (catLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-100 aspect-square animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 text-lg">Category not found.</p>
        <Link to="/products" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Browse all products →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        {' / '}
        <Link to="/products" className="hover:underline">
          Products
        </Link>
        {' / '}
        <span className="text-gray-900">{category.name}</span>
      </nav>

      <div className="flex gap-8">
        {/* Filter sidebar */}
        {((facets?.brands.length ?? 0) > 0 || (facets?.attributes?.length ?? 0) > 0) && (
          <aside className="w-52 flex-shrink-0">
            <FilterPanel
              facets={facets}
              brandIds={brandIds}
              attributeValueIds={attributeValueIds}
              minPriceCents={minPriceCents}
              maxPriceCents={maxPriceCents}
              inStock={inStock}
              onBrandToggle={handleBrandToggle}
              onAttributeToggle={handleAttributeToggle}
              onPriceApply={handlePriceApply}
              onInStock={handleInStock}
              onReset={reset}
            />
          </aside>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
              {category.description && (
                <p className="mt-1 text-gray-500 text-sm">{category.description}</p>
              )}
              {!isLoading && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {totalCount} product{totalCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortBy)
                setOffset(0)
              }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: LIMIT }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-gray-100 aspect-square animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
              >
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {(hasPrev || hasNext) && (
                <div className="flex items-center justify-center gap-3 mt-12">
                  <button
                    type="button"
                    onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                    disabled={!hasPrev || isFetching}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    {Math.floor(offset / LIMIT) + 1} / {Math.ceil(totalCount / LIMIT)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOffset((o) => o + LIMIT)}
                    disabled={!hasNext || isFetching}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24 text-gray-400">
              <p className="text-lg">
                {brandIds.length ||
                attributeValueIds.length ||
                minPriceCents ||
                maxPriceCents ||
                inStock
                  ? 'No products match your filters.'
                  : 'No products in this category yet.'}
              </p>
              {(brandIds.length > 0 ||
                attributeValueIds.length > 0 ||
                minPriceCents ||
                maxPriceCents ||
                inStock) && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 text-sm text-indigo-600 hover:underline"
                >
                  Reset filters
                </button>
              )}
              <Link to="/products" className="mt-4 block text-sm text-indigo-600 hover:underline">
                Browse all products →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
