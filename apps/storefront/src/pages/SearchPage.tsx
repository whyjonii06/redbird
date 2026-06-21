import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard.js'
import { trpc } from '../trpc.js'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  const { data, isLoading } = trpc.catalog.search.useQuery({ q }, { enabled: q.length > 0 })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Search results</h1>
      <p className="text-gray-500 mb-8">{q ? `Results for "${q}"` : 'Enter a search term above'}</p>

      {isLoading && <p className="text-gray-500">Searching…</p>}

      {data && data.length === 0 && <p className="text-gray-500">No products found for "{q}".</p>}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
