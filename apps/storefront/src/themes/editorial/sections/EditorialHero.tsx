import { Link } from 'react-router-dom'

type Config = {
  image: string
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
  imagePosition: 'left' | 'right'
}

export function EditorialHero({ config }: { config: Config }) {
  const imgLeft = config.imagePosition === 'left'

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: '90vh',
      }}
    >
      {imgLeft && <ImagePanel image={config.image} />}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(40px, 8vw, 120px)',
          background: '#fafaf9',
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
              marginBottom: 24,
            }}
          >
            {config.eyebrow}
          </p>
        )}
        <h1
          style={{
            fontSize: 'clamp(36px,4vw,64px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            marginBottom: 24,
            whiteSpace: 'pre-line',
          }}
        >
          {config.title}
        </h1>
        <p
          style={{
            fontSize: 18,
            color: '#6b7280',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 440,
          }}
        >
          {config.body}
        </p>
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
          {config.ctaLabel || 'Explore'} →
        </Link>
      </div>
      {!imgLeft && <ImagePanel image={config.image} />}
    </section>
  )
}

function ImagePanel({ image }: { image: string }) {
  return (
    <div
      style={{
        background: image ? `url(${image}) center/cover` : '#e5e7eb',
        minHeight: 500,
      }}
    />
  )
}
