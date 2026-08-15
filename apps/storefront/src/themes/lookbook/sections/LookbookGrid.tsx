import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/index.js'
import { optimizedSrc, optimizedSrcSet } from '../../../optimizedImage.js'
import { trpc } from '../../../trpc.js'

type GridItem = {
  id: string
  image: string
  productId: string | null
  label: string
  size: 'small' | 'large'
}
type Config = { items: GridItem[] }

export function LookbookGrid({ config }: { config: Config }) {
  const items = config.items ?? []
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[]
  const { locale } = useI18n()
  const { data: products = [] } = trpc.catalog.list.useQuery(
    { status: 'active', limit: 20, locale },
    { enabled: productIds.length > 0 },
  )
  const productMap = Object.fromEntries(
    products.filter((p) => productIds.includes(p.id)).map((p) => [p.id, p]),
  )

  if (items.length === 0) return null

  return (
    <section style={{ padding: '0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoRows: '40vw',
          gap: 4,
          maxHeight: '80vw',
          overflow: 'hidden',
        }}
      >
        {items.map((item) => {
          const product = item.productId ? productMap[item.productId] : null
          const isLarge = item.size === 'large'
          return (
            <div
              key={item.id}
              style={{
                gridColumn: isLarge ? 'span 2' : 'span 1',
                gridRow: isLarge ? 'span 2' : 'span 1',
                position: 'relative',
                overflow: 'hidden',
                background: '#f3f4f6',
              }}
            >
              {item.image && (
                <img
                  src={optimizedSrc(item.image, isLarge ? 800 : 400)}
                  srcSet={optimizedSrcSet(item.image, [300, 600, 900])}
                  sizes={isLarge ? '66vw' : '33vw'}
                  loading="lazy"
                  alt={item.label || product?.name || ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.6s ease',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.target as HTMLImageElement).style.transform = 'scale(1.04)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.target as HTMLImageElement).style.transform = 'scale(1)'
                  }}
                />
              )}
              {product && (
                <Link
                  to={`/products/${product.slug}`}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                    padding: '40px 20px 20px',
                    color: '#fff',
                    textDecoration: 'none',
                    opacity: 0,
                    transition: 'opacity 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLAnchorElement).style.opacity = '0'
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{product.name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>View →</p>
                </Link>
              )}
              {item.label && !product && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    padding: '6px 12px',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 4,
                  }}
                >
                  {item.label}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
