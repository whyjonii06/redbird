import { Link } from 'react-router-dom'

const PLUGINS = [
  { icon: '💳', title: 'Stripe & PayPal', desc: 'One-click payment plugins, Apple Pay & Google Pay included.' },
  { icon: '📦', title: 'Shipping zones', desc: 'Weight-based rates, country zones, free shipping thresholds.' },
  { icon: '🇪🇺', title: 'EU VAT', desc: '27 countries, VIES validation, B2B reverse charge.' },
  { icon: '✉️', title: 'Transactional emails', desc: 'Resend or SMTP — order confirmations, reset links.' },
  { icon: '⭐', title: 'Product reviews', desc: 'Verified buyer reviews with moderation queue.' },
  { icon: '📊', title: 'Analytics', desc: 'Store events forwarded to your analytics provider.' },
]

const THEMES = [
  { icon: '🛍️', title: 'Classic', desc: 'Traditional storefront. Products front and center, familiar UX.' },
  { icon: '📰', title: 'Editorial', desc: 'Magazine-style layout. Large photography, story-driven browsing.' },
  { icon: '🏢', title: 'B2B', desc: 'Professional catalog. Customer group pricing, bulk ordering.' },
  { icon: '🎨', title: 'Custom theme', desc: 'Build your own storefront in React, Next.js, or any framework.' },
  { icon: '➕', title: 'Submit a theme', desc: 'Community-built themes reviewed and listed in the marketplace.' },
]

const cardStyle: React.CSSProperties = {
  padding: '24px',
  borderRadius: 16,
  background: '#111',
  border: '1px solid #1f2937',
}

export function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '96px 24px 80px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px',
          borderRadius: 99, border: '1px solid #374151', marginBottom: 32, fontSize: 12, color: '#9ca3af',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          🇫🇷 Made in France · Source-available commerce engine
        </div>
        <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: 24 }}>
          The e-commerce engine<br />
          <span style={{ color: '#e8302a' }}>built for developers</span>
        </h1>
        <p style={{ fontSize: 18, color: '#9ca3af', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>
          TypeScript-first, self-hosted, end-to-end type-safe. Runs <strong style={{ color: '#e5e7eb' }}>instantly</strong> —
          no database to install, no Docker, no config. You own the code.
        </p>
        <div style={{
          maxWidth: 440, margin: '0 auto 36px', padding: '16px 20px', borderRadius: 12,
          background: '#0a0a0a', border: '1px solid #1f2937', textAlign: 'left',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, lineHeight: 1.9,
        }}>
          <div style={{ color: '#6b7280' }}># a full store in 60 seconds — no database needed</div>
          <div><span style={{ color: '#22c55e' }}>$</span> <span style={{ color: '#e5e7eb' }}>npm create redbird-shop@latest my-store</span></div>
          <div style={{ color: '#6b7280' }}>→ API + storefront, seeded, on an embedded database</div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://demo.redbirdshop.dev" target="_blank" rel="noreferrer" style={{
            padding: '14px 32px', borderRadius: 12, background: '#e8302a', color: '#fff',
            fontWeight: 700, fontSize: 15, display: 'inline-block',
          }}>
            See the live demo →
          </a>
          <a href="https://github.com/whyjonii06/redbird" target="_blank" rel="noreferrer" style={{
            padding: '14px 32px', borderRadius: 12, border: '1px solid #374151', color: '#e5e7eb',
            fontWeight: 600, fontSize: 15, display: 'inline-block',
          }}>
            View on GitHub
          </a>
          <a href="https://discord.gg/cPXVRzwAHd" target="_blank" rel="noreferrer" style={{
            padding: '14px 32px', borderRadius: 12, background: '#5865F2', color: '#fff',
            fontWeight: 700, fontSize: 15, display: 'inline-block',
          }}>
            Join the Discord
          </a>
          <Link to="/pricing" style={{
            padding: '14px 32px', borderRadius: 12, border: '1px solid #374151', color: '#e5e7eb',
            fontWeight: 600, fontSize: 15, display: 'inline-block',
          }}>
            Pricing
          </Link>
        </div>
      </section>

      {/* Why developers */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { icon: '⚡', title: 'Runs in seconds, zero setup', desc: 'Ships with an embedded database (PGlite). No PostgreSQL, no Docker, no DATABASE_URL to start. Point it at Postgres only for production.' },
            { icon: '🔗', title: 'End-to-end type safety', desc: 'One TypeScript type flows from the database (Drizzle) through the API (tRPC) to your frontend. No GraphQL codegen, no drift.' },
            { icon: '🔓', title: 'You own it', desc: 'Self-hosted, source available, no per-transaction fees, no vendor lock-in. Read the whole engine in an afternoon.' },
          ].map((f) => (
            <div key={f.title} style={cardStyle}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built for France & the EU */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
        <div
          style={{
            borderRadius: 20,
            border: '1px solid #1f2937',
            background: 'linear-gradient(180deg, rgba(232,48,42,0.06), transparent)',
            padding: '40px 32px',
          }}
        >
          <h2
            style={{
              textAlign: 'center',
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: '-0.03em',
            }}
          >
            🇫🇷 Built for France &amp; the EU
          </h2>
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 15, marginBottom: 40, maxWidth: 620, margin: '0 auto 40px' }}>
            Most engines treat European compliance as an afterthought. Redbird ships it in the
            core — the stuff Shopify and US-first tools do poorly.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {[
              { icon: '🧾', title: 'Factur-X e-invoicing', desc: 'Every order generates a compliant PDF/A-3 invoice with the structured EN 16931 XML embedded — ready for the French e-invoicing reform and Chorus Pro.' },
              { icon: '🔢', title: 'Legal invoice numbering', desc: 'Sequential, gapless, per-year — exactly what French law requires.' },
              { icon: '📒', title: 'FEC accounting export', desc: 'The mandatory Fichier des Écritures Comptables, balanced double-entry, one click from the back office.' },
              { icon: '🇪🇺', title: 'EU VAT & relay delivery', desc: '27-country VAT with VIES validation, B2B reverse charge, and Mondial Relay relay-point delivery.' },
            ].map((f) => (
              <div key={f.title} style={cardStyle}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginTop: 28 }}>
            Back office and storefront available in 🇬🇧 English · 🇫🇷 French · 🇪🇸 Spanish · 🇩🇪 German.
          </p>
        </div>
      </section>

      {/* Plugins */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.03em' }}>
          Official plugins
        </h2>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 15, marginBottom: 48 }}>
          Payments, shipping, taxes, emails — everything you need, ready to install.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {PLUGINS.map((f) => (
            <div key={f.title} style={cardStyle}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 96px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.03em' }}>
          Storefront themes
        </h2>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 15, marginBottom: 48 }}>
          Swap the entire frontend in one command. The API stays the same.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {THEMES.map((t) => (
            <div key={t.title} style={cardStyle}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{t.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t.title}</h3>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 640, margin: '0 auto 96px', padding: '48px 32px', borderRadius: 24,
        background: '#111', border: '1px solid #1f2937', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.03em' }}>One subscription, all plugins</h2>
        <p style={{ color: '#9ca3af', marginBottom: 32, fontSize: 15 }}>
          €49/month. Cancel anytime. Includes all current and future official plugins.
        </p>
        <Link to="/pricing" style={{
          padding: '14px 40px', borderRadius: 12, background: '#e8302a', color: '#fff',
          fontWeight: 700, fontSize: 15, display: 'inline-block',
        }}>
          Subscribe now →
        </Link>
      </section>
    </main>
  )
}
