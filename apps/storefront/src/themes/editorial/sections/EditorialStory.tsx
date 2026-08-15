import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/index.js'
import { optimizedSrc } from '../../../optimizedImage.js'
import { trpc } from '../../../trpc.js'
import { fmt } from '../../../trpc.js'

type Config = {
  image: string
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
  imagePosition: 'left' | 'right'
  productId: string | null
}

export function EditorialStory({ config }: { config: Config }) {
  const imgRight = config.imagePosition === 'right'
  const { locale } = useI18n()
  const { data: product } = trpc.catalog.byId.useQuery(
    { id: config.productId!, locale },
    { enabled: !!config.productId },
  )

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: 560,
        borderTop: '1px solid #e5e7eb',
      }}
    >
      {!imgRight && <ImagePanel image={config.image} />}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(40px,6vw,96px)',
        }}
      >
        {config.eyebrow && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              marginBottom: 20,
            }}
          >
            {config.eyebrow}
          </p>
        )}
        <h2
          style={{
            fontSize: 'clamp(28px,3vw,48px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {config.title}
        </h2>
        <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.75, marginBottom: 32 }}>
          {config.body}
        </p>
        {product && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24,
              padding: '16px',
              background: '#f9fafb',
              borderRadius: 12,
            }}
          >
            {product.images?.[0] && (
              <img
                src={optimizedSrc(product.images[0].url, 128)}
                alt={product.name}
                loading="lazy"
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{product.name}</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>
                {product.variants[0]
                  ? fmt(product.variants[0].priceAmount, product.variants[0].priceCurrency)
                  : ''}
              </p>
            </div>
            <Link
              to={`/products/${product.slug}`}
              style={{
                marginLeft: 'auto',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--primary,#4f46e5)',
              }}
            >
              View →
            </Link>
          </div>
        )}
        {config.ctaLabel && (
          <Link
            to={config.ctaUrl || '/products'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              color: '#111',
              textDecoration: 'none',
              borderBottom: '2px solid #111',
              paddingBottom: 4,
              alignSelf: 'flex-start',
            }}
          >
            {config.ctaLabel} →
          </Link>
        )}
      </div>
      {imgRight && <ImagePanel image={config.image} />}
    </section>
  )
}

function ImagePanel({ image }: { image: string }) {
  return (
    <div
      style={{
        background: image ? `url(${optimizedSrc(image, 1200)}) center/cover` : '#f3f4f6',
        minHeight: 400,
      }}
    />
  )
}
