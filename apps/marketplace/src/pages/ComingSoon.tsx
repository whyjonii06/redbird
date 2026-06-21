/** Temporary holding page shown while the public site is masked. */
export function ComingSoon() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#e5e7eb',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <img
        src="/redbird.svg"
        alt="Redbird"
        width={120}
        style={{ height: 'auto', filter: 'drop-shadow(0 0 40px rgba(232,48,42,0.25))' }}
      />
      <h1
        style={{
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          margin: '28px 0 8px',
        }}
      >
        Redbird<span style={{ color: '#e8302a' }}>.</span>
      </h1>
      <p style={{ color: '#9ca3af', fontSize: 15, margin: 0 }}>Coming soon.</p>
    </main>
  )
}
