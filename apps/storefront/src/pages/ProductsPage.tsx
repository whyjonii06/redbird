import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterPanel } from '../components/FilterPanel.js'
import { ProductCard } from '../components/ProductCard.js'
import { trpc } from '../trpc.js'

const LIMIT = 12
type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'name'

export function ProductsPage() {
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [minPriceCents, setMinPriceCents] = useState<number | undefined>()
  const [maxPriceCents, setMaxPriceCents] = useState<number | undefined>()
  const [inStock, setInStock] = useState(false)

  const { data, isLoading, isFetching } = trpc.catalog.filter.useQuery({
    limit: LIMIT,
    offset,
    sortBy,
    brandIds: brandIds.length ? brandIds : undefined,
    minPrice: minPriceCents,
    maxPrice: maxPriceCents,
    inStock: inStock || undefined,
  })

  const { data: categories = [] } = trpc.categories.list.useQuery()

  const products = data?.products ?? []
  const totalCount = data?.totalCount ?? 0
  const facets = data?.facets

  const hasPrev = offset > 0
  const hasNext = offset + LIMIT < totalCount

  function reset() {
    setBrandIds([])
    setMinPriceCents(undefined)
    setMaxPriceCents(undefined)
    setInStock(false)
    setOffset(0)
  }

  function handleBrandToggle(id: string) {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
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

  const hasSidebar = categories.length > 0 || (facets?.brands.length ?? 0) > 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex gap-8">
        {/* Left sidebar */}
        {hasSidebar && (
          <aside className="w-52 flex-shrink-0 space-y-8">
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Categories
                </p>
                <ul className="space-y-1">
                  <li>
                    <Link
                      to="/products"
                      className="block text-sm font-medium px-2 py-1 rounded-lg"
                      style={{ color: 'var(--primary)', background: 'rgba(79,70,229,0.06)' }}
                    >
                      All products
                    </Link>
                  </li>
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to={`/category/${cat.slug}`}
                        className="block text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FilterPanel
              facets={facets}
              brandIds={brandIds}
              minPriceCents={minPriceCents}
              maxPriceCents={maxPriceCents}
              inStock={inStock}
              onBrandToggle={handleBrandToggle}
              onPriceApply={handlePriceApply}
              onInStock={handleInStock}
              onReset={reset}
            />
          </aside>
        )}

        {/* Main grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
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
              <p className="text-lg">No products match your filters.</p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 text-sm text-indigo-600 hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
