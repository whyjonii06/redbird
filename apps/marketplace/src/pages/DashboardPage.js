import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
export function DashboardPage() {
    const [key, setKey] = useState('');
    const [license, setLicense] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [verified, setVerified] = useState(false);
    async function verify(e) {
        e.preventDefault();
        if (!key.trim()) {
            setError('License key required');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/licenses/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key.trim() }),
            });
            const data = await res.json();
            if (data.valid) {
                setLicense({ key: key.trim(), email: data.email, plan: data.plan, status: 'active', expiresAt: data.expiresAt, createdAt: '' });
                setVerified(true);
            }
            else {
                setError('Invalid or expired license key.');
            }
        }
        catch {
            setError('Could not reach the license server.');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("main", { style: { maxWidth: 520, margin: '80px auto', padding: '0 24px' }, children: [_jsx("h1", { style: { fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }, children: "My license" }), _jsx("p", { style: { color: '#9ca3af', marginBottom: 40, fontSize: 14 }, children: "Enter your license key to check its status." }), !verified ? (_jsxs("form", { onSubmit: (e) => void verify(e), style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("input", { type: "text", value: key, onChange: (e) => { setKey(e.target.value); setError(null); }, placeholder: "rb_live_...", style: {
                            padding: '14px 16px', borderRadius: 12, border: '1px solid #374151',
                            background: '#111', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace',
                        } }), error && _jsx("p", { style: { color: '#e8302a', fontSize: 13 }, children: error }), _jsx("button", { type: "submit", disabled: loading, style: {
                            padding: '13px', borderRadius: 12, background: '#e8302a', color: '#fff',
                            fontWeight: 700, fontSize: 14, border: 'none',
                            opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                        }, children: loading ? 'Checking…' : 'Verify license' })] })) : license && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs("div", { style: { background: '#111', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: 24 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }, children: [_jsx("span", { style: {
                                            padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                                            background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                                            textTransform: 'uppercase',
                                        }, children: license.plan }), _jsx("span", { style: { fontSize: 12, color: '#22c55e' }, children: "\u25CF Active" })] }), _jsx("div", { style: { display: 'grid', gap: 12 }, children: [
                                    { label: 'Email', value: license.email },
                                    { label: 'License key', value: license.key },
                                    { label: 'Expires', value: license.expiresAt ?? 'Never (active subscription)' },
                                ].map(({ label, value }) => (_jsxs("div", { children: [_jsx("p", { style: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }, children: label }), _jsx("p", { style: { fontSize: 13, fontFamily: label === 'License key' ? 'monospace' : 'inherit', color: '#e5e7eb' }, children: value })] }, label))) })] }), _jsxs("div", { style: { background: '#111', border: '1px solid #1f2937', borderRadius: 16, padding: '20px' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, marginBottom: 10 }, children: "Use in your Redbird config:" }), _jsx("pre", { style: { fontSize: 12, fontFamily: 'monospace', color: '#a8b5c9', lineHeight: 1.6, overflowX: 'auto' }, children: `createRedbird({
  licenseKey: '${license.key}',
  plugins: [...],
})` })] }), _jsx("button", { onClick: () => { setVerified(false); setLicense(null); setKey(''); }, style: { padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }, children: "Check another key" })] })), _jsxs("div", { style: { marginTop: 48, padding: '20px', borderRadius: 12, border: '1px solid #1f2937', background: '#111' }, children: [_jsx("p", { style: { fontSize: 13, color: '#6b7280', marginBottom: 6 }, children: "Don't have a license yet?" }), _jsx(Link, { to: "/pricing", style: { fontSize: 14, color: '#e8302a', fontWeight: 600 }, children: "Subscribe to Redbird Pro \u2192" })] })] }));
}
