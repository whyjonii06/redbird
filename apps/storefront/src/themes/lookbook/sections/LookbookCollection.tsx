import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { fmt, trpc } from '../../../trpc.js'

type Config = { title: string; productIds: string[] }

export function LookbookCollection({ config }: { config: Config }) {
  const ref = useRef<HTMLDivElement>(null)
  const { data: products = [] } = trpc.catalog.list.useQuery({ status: 'active', limit: 8 })

  if (products.length === 0) return null

  const scroll = (dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  return (
    <section style={{ padding: '80px 0', background: '#fafaf9', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          marginBottom: 40,
        }}
      >
        <h2
          style={{ fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 800, letterSpacing: '-0.03em' }}
        >
          {config.title || 'Featured pieces'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => scroll(-1)} style={navBtn}>
            ‹
          </button>
          <button type="button" onClick={() => scroll(1)} style={navBtn}>
            ›
          </button>
        </div>
      </div>
      <div
        ref={ref}
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          paddingLeft: 40,
          scrollbarWidth: 'none',
          scrollSnapType: 'x mandatory',
        }}
      >
        {products.map((product) => {
          const image = product.images?.[0]?.url
          const variant = product.variants[0]
          return (
            <Link
              key={product.id}
              to={`/products/${product.slug}`}
              style={{
                flexShrink: 0,
                width: 300,
                scrollSnapAlign: 'start',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  background: image ? `url(${image}) center/cover` : '#e5e7eb',
                  aspectRatio: '3/4',
                  marginBottom: 16,
                }}
              />
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{product.name}</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>
                {variant ? fmt(variant.priceAmount, variant.priceCurrency) : ''}
              </p>
            </Link>
          )
        })}
        <div style={{ flexShrink: 0, width: 40 }} />
      </div>
    </section>
  )
}

const navBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: '1px solid #d1d5db',
  borderRadius: '50%',
  background: '#fff',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
