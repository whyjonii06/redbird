import { Link } from 'react-router-dom'
import { trpc } from '../../../trpc.js'

type Config = { title: string; categoryIds: string[] }

export function CategoryShowcase({ config }: { config: Config }) {
  const { data: allCats = [] } = trpc.categories.list.useQuery()
  const cats =
    config.categoryIds?.length > 0
      ? allCats.filter((c) => config.categoryIds.includes(c.id))
      : allCats.slice(0, 6)

  if (cats.length === 0) return null

  return (
    <section style={{ background: '#f9fafb', padding: '64px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 40,
            textAlign: 'center',
          }}
        >
          {config.title || 'Shop by category'}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
          }}
        >
          {cats.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 16px',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                transition: 'box-shadow 0.2s',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'var(--primary,#4f46e5)',
                  opacity: 0.15,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
