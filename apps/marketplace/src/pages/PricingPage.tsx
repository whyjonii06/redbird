import { useState } from 'react'

export function PricingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email required'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: window.location.href }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Failed to create checkout session')
      }
    } catch {
      setError('Could not reach the server. Is the license server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }}>Redbird Pro</h1>
        <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>
          €49<span style={{ fontSize: 20, fontWeight: 500, color: '#9ca3af' }}>/month</span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Cancel anytime. All official plugins included.</p>
      </div>

      <ul style={{ listStyle: 'none', marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          'All current plugins (Stripe, PayPal, Resend, SMTP, VAT…)',
          'All future plugins as they launch',
          'License key for unlimited stores',
          'Priority support',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#d1d5db' }}>
            <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }}>✓</span>
            {item}
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void handleSubscribe(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="your@email.com"
          required
          style={{
            padding: '14px 16px', borderRadius: 12, border: '1px solid #374151',
            background: '#111', color: '#fff', fontSize: 15, outline: 'none',
          }}
        />
        {error && <p style={{ color: '#e8302a', fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '14px', borderRadius: 12, background: '#e8302a', color: '#fff',
            fontWeight: 700, fontSize: 15, border: 'none',
            opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Redirecting…' : 'Subscribe with Stripe →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#4b5563' }}>
        Secured by Stripe. Your payment info never touches our servers.
      </p>
    </main>
  )
}
