import { Link } from 'react-router-dom'
import { fmt, trpc } from '../../../trpc.js'

type Config = { productId: string | null; quote: string; quoteAuthor: string }

export function EditorialFeatured({ config }: { config: Config }) {
  const { data: product } = trpc.catalog.byId.useQuery(
    { id: config.productId! },
    { enabled: !!config.productId },
  )

  if (!product) return null
  const variant = product.variants[0]
  const image = product.images?.[0]?.url

  return (
    <section
      style={{
        borderTop: '1px solid #e5e7eb',
        padding: '80px 24px',
        background: '#111',
        color: '#fff',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          {image && (
            <img
              src={image}
              alt={product.name}
              style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 4 }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              bottom: -24,
              right: -24,
              background: 'var(--primary,#4f46e5)',
              padding: '20px 28px',
              borderRadius: 12,
              maxWidth: 200,
            }}
          >
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              Starting from
            </p>
            <p style={{ fontSize: 22, fontWeight: 800 }}>
              {variant ? fmt(variant.priceAmount, variant.priceCurrency) : '—'}
            </p>
          </div>
        </div>

        <div style={{ paddingRight: 40 }}>
          <p
            style={{
              fontSize: 48,
              color: 'rgba(255,255,255,0.15)',
              fontFamily: 'Georgia,serif',
              lineHeight: 1,
              marginBottom: 24,
            }}
          >
            "
          </p>
          {config.quote && (
            <blockquote
              style={{
                fontSize: 'clamp(20px,2.5vw,30px)',
                fontWeight: 600,
                lineHeight: 1.4,
                fontStyle: 'italic',
                marginBottom: 16,
              }}
            >
              {config.quote}
            </blockquote>
          )}
          {config.quoteAuthor && (
            <p
              style={{ fontSize: 13, color: '#9ca3af', marginBottom: 48, letterSpacing: '0.05em' }}
            >
              — {config.quoteAuthor}
            </p>
          )}
          <h2
            style={{
              fontSize: 'clamp(24px,3vw,40px)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              marginBottom: 12,
            }}
          >
            {product.name}
          </h2>
          {product.description && (
            <p style={{ color: '#9ca3af', lineHeight: 1.7, marginBottom: 32, fontSize: 15 }}>
              {product.description.slice(0, 160)}
              {product.description.length > 160 ? '…' : ''}
            </p>
          )}
          <Link
            to={`/products/${product.slug}`}
            style={{
              display: 'inline-block',
              padding: '16px 40px',
              borderRadius: 10,
              background: '#fff',
              color: '#111',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Discover this piece →
          </Link>
        </div>
      </div>
    </section>
  )
}
