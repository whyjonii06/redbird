import { Link } from 'react-router-dom'
import { ProductCard } from '../../../components/ProductCard.js'
import { trpc } from '../../../trpc.js'

type Config = { title: string; productIds: string[]; columns: 2 | 3 | 4 }

export function FeaturedProducts({ config }: { config: Config }) {
  const cols = config.columns ?? 4
  const { data: products = [], isLoading } = trpc.catalog.list.useQuery({
    status: 'active',
    limit: cols * 2,
  })

  if (products.length === 0 && !isLoading) return null

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          {config.title || 'New arrivals'}
        </h2>
        <Link
          to="/products"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary,#4f46e5)' }}
        >
          View all →
        </Link>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 24,
        }}
      >
        {isLoading
          ? Array.from({ length: cols * 2 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '3/4',
                  borderRadius: 16,
                  background: '#f3f4f6',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            ))
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}
