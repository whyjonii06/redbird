import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Temporary holding page shown while the public site is masked. */
export function ComingSoon() {
    return (_jsxs("main", { style: {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            color: '#e5e7eb',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            textAlign: 'center',
            padding: 24,
        }, children: [_jsx("img", { src: "/redbird.svg", alt: "Redbird", width: 120, style: { height: 'auto', filter: 'drop-shadow(0 0 40px rgba(232,48,42,0.25))' } }), _jsxs("h1", { style: {
                    fontSize: 'clamp(28px, 5vw, 44px)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    margin: '28px 0 8px',
                }, children: ["Redbird", _jsx("span", { style: { color: '#e8302a' }, children: "." })] }), _jsx("p", { style: { color: '#9ca3af', fontSize: 15, margin: 0 }, children: "Coming soon." })] }));
}
