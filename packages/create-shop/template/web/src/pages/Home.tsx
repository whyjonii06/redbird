import { Link } from 'react-router-dom'
import { fmt, trpc } from '../trpc'

export function Home() {
  const { data: products, isLoading } = trpc.catalog.list.useQuery({})

  if (isLoading) return <p className="text-gray-400">Loading…</p>
  if (!products?.length) return <p className="text-gray-400">No products yet.</p>

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {products.map((p) => {
        const variant = p.variants[0]
        const cover = p.images[0]
        return (
          <Link key={p.id} to={`/products/${p.slug}`} className="group block">
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-2">
              {cover && (
                <img
                  src={cover.url}
                  alt={cover.alt ?? p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              )}
            </div>
            <p className="text-sm font-medium">{p.name}</p>
            {variant && (
              <p className="text-sm" style={{ color: 'var(--primary)' }}>
                {fmt(variant.priceAmount, variant.priceCurrency)}
              </p>
            )}
          </Link>
        )
      })}
    </div>
  )
}
