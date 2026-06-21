import { useState } from 'react'

type Config = { title: string; subtitle: string; placeholder: string; ctaLabel: string }

export function Newsletter({ config }: { config: Config }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim()) setSubmitted(true)
  }

  return (
    <section style={{ background: 'var(--primary,#4f46e5)', padding: '80px 24px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', color: '#fff' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
          {config.title || 'Stay in the loop'}
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 32 }}>
          {config.subtitle || 'Get new arrivals and exclusive offers straight to your inbox.'}
        </p>
        {submitted ? (
          <p style={{ fontSize: 16, fontWeight: 600 }}>Thanks — you're subscribed! 🎉</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={config.placeholder || 'your@email.com'}
              required
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 10,
                border: 'none',
                fontSize: 15,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '14px 24px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.25)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {config.ctaLabel || 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
