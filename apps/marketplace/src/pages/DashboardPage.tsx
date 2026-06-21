import { useState } from 'react'
import { Link } from 'react-router-dom'

type LicenseInfo = { key: string; email: string; plan: string; status: string; expiresAt: string | null; createdAt: string }

export function DashboardPage() {
  const [key, setKey] = useState('')
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) { setError('License key required'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/licenses/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      const data = await res.json() as { valid: boolean; plan: string; email: string; expiresAt: string | null }
      if (data.valid) {
        setLicense({ key: key.trim(), email: data.email, plan: data.plan, status: 'active', expiresAt: data.expiresAt, createdAt: '' })
        setVerified(true)
      } else {
        setError('Invalid or expired license key.')
      }
    } catch {
      setError('Could not reach the license server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>My license</h1>
      <p style={{ color: '#9ca3af', marginBottom: 40, fontSize: 14 }}>Enter your license key to check its status.</p>

      {!verified ? (
        <form onSubmit={(e) => void verify(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null) }}
            placeholder="rb_live_..."
            style={{
              padding: '14px 16px', borderRadius: 12, border: '1px solid #374151',
              background: '#111', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace',
            }}
          />
          {error && <p style={{ color: '#e8302a', fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px', borderRadius: 12, background: '#e8302a', color: '#fff',
              fontWeight: 700, fontSize: 14, border: 'none',
              opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Checking…' : 'Verify license'}
          </button>
        </form>
      ) : license && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#111', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                textTransform: 'uppercase',
              }}>
                {license.plan}
              </span>
              <span style={{ fontSize: 12, color: '#22c55e' }}>● Active</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Email', value: license.email },
                { label: 'License key', value: license.key },
                { label: 'Expires', value: license.expiresAt ?? 'Never (active subscription)' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 13, fontFamily: label === 'License key' ? 'monospace' : 'inherit', color: '#e5e7eb' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#111', border: '1px solid #1f2937', borderRadius: 16, padding: '20px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Use in your Redbird config:</p>
            <pre style={{ fontSize: 12, fontFamily: 'monospace', color: '#a8b5c9', lineHeight: 1.6, overflowX: 'auto' }}>
{`createRedbird({
  licenseKey: '${license.key}',
  plugins: [...],
})`}
            </pre>
          </div>

          <button
            onClick={() => { setVerified(false); setLicense(null); setKey('') }}
            style={{ padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}
          >
            Check another key
          </button>
        </div>
      )}

      <div style={{ marginTop: 48, padding: '20px', borderRadius: 12, border: '1px solid #1f2937', background: '#111' }}>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Don't have a license yet?</p>
        <Link to="/pricing" style={{ fontSize: 14, color: '#e8302a', fontWeight: 600 }}>
          Subscribe to Redbird Pro →
        </Link>
      </div>
    </main>
  )
}
