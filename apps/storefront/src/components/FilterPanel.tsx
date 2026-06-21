import { useEffect, useState } from 'react'

type Facets = {
  brands: { id: string; name: string; count: number }[]
  priceRange: { min: number; max: number }
  attributes?: {
    id: string
    name: string
    values: { id: string; value: string; count: number }[]
  }[]
}

type Props = {
  facets: Facets | undefined
  brandIds: string[]
  attributeValueIds?: string[]
  minPriceCents: number | undefined
  maxPriceCents: number | undefined
  inStock: boolean
  onBrandToggle: (id: string) => void
  onAttributeToggle?: (valueId: string) => void
  onPriceApply: (min: number | undefined, max: number | undefined) => void
  onInStock: (v: boolean) => void
  onReset: () => void
}

export function FilterPanel({
  facets,
  brandIds,
  attributeValueIds,
  minPriceCents,
  maxPriceCents,
  inStock,
  onBrandToggle,
  onAttributeToggle,
  onPriceApply,
  onInStock,
  onReset,
}: Props) {
  const [minStr, setMinStr] = useState(
    minPriceCents !== undefined ? String(Math.floor(minPriceCents / 100)) : '',
  )
  const [maxStr, setMaxStr] = useState(
    maxPriceCents !== undefined ? String(Math.ceil(maxPriceCents / 100)) : '',
  )

  useEffect(() => {
    setMinStr(minPriceCents !== undefined ? String(Math.floor(minPriceCents / 100)) : '')
    setMaxStr(maxPriceCents !== undefined ? String(Math.ceil(maxPriceCents / 100)) : '')
  }, [minPriceCents, maxPriceCents])

  const hasFilters =
    brandIds.length > 0 ||
    (attributeValueIds?.length ?? 0) > 0 ||
    minPriceCents !== undefined ||
    maxPriceCents !== undefined ||
    inStock
  const showBrands = (facets?.brands.length ?? 0) > 0
  const showAttributes = (facets?.attributes?.length ?? 0) > 0
  const showPrice =
    facets !== undefined &&
    facets.priceRange.max > 0 &&
    facets.priceRange.max > facets.priceRange.min

  if (!showBrands && !showAttributes && !showPrice && !inStock) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</p>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            Reset
          </button>
        )}
      </div>

      {showBrands && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2.5">Brand</p>
          <div className="space-y-1.5">
            {facets!.brands.map((b) => (
              <label
                htmlFor="f-0"
                key={b.id}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <input
                  id="f-0"
                  type="checkbox"
                  checked={brandIds.includes(b.id)}
                  onChange={() => onBrandToggle(b.id)}
                  className="rounded accent-indigo-600"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 flex-1 leading-none">
                  {b.name}
                </span>
                <span className="text-xs text-gray-400">{b.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showAttributes &&
        (facets?.attributes ?? []).map((attr) => (
          <div key={attr.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {attr.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {attr.values.map((v) => {
                const isSelected = attributeValueIds?.includes(v.id) ?? false
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => onAttributeToggle?.(v.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {v.value}
                    <span className="ml-1 text-gray-400">({v.count})</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      {showPrice && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2.5">Price (€)</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const min = minStr !== '' ? Math.round(Number.parseFloat(minStr) * 100) : undefined
              const max = maxStr !== '' ? Math.round(Number.parseFloat(maxStr) * 100) : undefined
              onPriceApply(min, max)
            }}
            className="space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                step="1"
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                placeholder={String(Math.floor(facets!.priceRange.min / 100))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-gray-400 text-xs flex-shrink-0">—</span>
              <input
                type="number"
                min="0"
                step="1"
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                placeholder={String(Math.ceil(facets!.priceRange.max / 100))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg font-medium transition-colors"
            >
              Apply
            </button>
          </form>
        </div>
      )}

      <label htmlFor="f-1" className="flex items-center gap-2 cursor-pointer">
        <input
          id="f-1"
          type="checkbox"
          checked={inStock}
          onChange={(e) => onInStock(e.target.checked)}
          className="rounded accent-indigo-600"
        />
        <span className="text-sm text-gray-600">In stock only</span>
      </label>
    </div>
  )
}
