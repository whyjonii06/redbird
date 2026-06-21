import { Link } from 'react-router-dom'

type Config = {
  mediaType: 'image' | 'video'
  mediaUrl: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaUrl: string
  overlay: number
}

export function LookbookHero({ config }: { config: Config }) {
  return (
    <section
      style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: '#000' }}
    >
      {config.mediaType === 'video' && config.mediaUrl ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          src={config.mediaUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: config.mediaUrl ? `url(${config.mediaUrl}) center/cover` : '#111',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(0,0,0,${config.overlay ?? 0.4})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {config.subtitle && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 20,
            }}
          >
            {config.subtitle}
          </p>
        )}
        <h1
          style={{
            fontSize: 'clamp(48px,8vw,120px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 0.95,
            marginBottom: 48,
            textTransform: 'uppercase',
          }}
        >
          {config.title}
        </h1>
        <Link
          to={config.ctaUrl || '/products'}
          style={{
            padding: '16px 48px',
            border: '2px solid #fff',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
          }}
        >
          {config.ctaLabel || 'Shop the look'}
        </Link>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Scroll
        </span>
        <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </section>
  )
}
