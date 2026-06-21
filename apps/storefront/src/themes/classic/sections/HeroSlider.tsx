import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Slide = {
  id: string
  image: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaUrl: string
}
type Config = { slides: Slide[]; autoplay: boolean; interval: number }

export function HeroSlider({ config }: { config: Config }) {
  const slides = config.slides ?? []
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!config.autoplay || slides.length < 2) return
    const t = setInterval(
      () => setCurrent((c) => (c + 1) % slides.length),
      (config.interval ?? 5) * 1000,
    )
    return () => clearInterval(t)
  }, [config.autoplay, config.interval, slides.length])

  if (slides.length === 0) return null
  const slide = slides[current]!

  return (
    <div
      style={{
        position: 'relative',
        height: '80vh',
        minHeight: 480,
        overflow: 'hidden',
        background: '#111',
      }}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: s.image ? `url(${s.image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 0.8s ease',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6))',
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
          padding: '0 24px',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(32px,6vw,72px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            marginBottom: 16,
            lineHeight: 1.1,
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p
            style={{
              fontSize: 'clamp(16px,2vw,22px)',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 40,
              maxWidth: 520,
            }}
          >
            {slide.subtitle}
          </p>
        )}
        <Link
          to={slide.ctaUrl || '/products'}
          style={{
            padding: '16px 40px',
            borderRadius: 12,
            background: 'var(--primary,#4f46e5)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {slide.ctaLabel || 'Shop now'}
        </Link>
      </div>

      {slides.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
          }}
        >
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 99,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrent((c) => (c - 1 + slides.length) % slides.length)}
            style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: 44,
              height: 44,
              borderRadius: '50%',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrent((c) => (c + 1) % slides.length)}
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: 44,
              height: 44,
              borderRadius: '50%',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
