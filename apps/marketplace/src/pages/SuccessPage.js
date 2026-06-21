import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
export function SuccessPage() {
    const [params] = useSearchParams();
    const sessionId = params.get('session_id');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!sessionId) {
            setLoading(false);
            return;
        }
        fetch(`/api/v1/checkout/session/${sessionId}`)
            .then((r) => r.json())
            .then((d) => setData(d))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [sessionId]);
    function copy() {
        if (!data?.licenseKey)
            return;
        void navigator.clipboard.writeText(data.licenseKey).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }
    if (loading) {
        return (_jsx("main", { style: { maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }, children: _jsx("div", { style: { color: '#9ca3af' }, children: "Loading\u2026" }) }));
    }
    return (_jsxs("main", { style: { maxWidth: 520, margin: '80px auto', padding: '0 24px', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 56, marginBottom: 24 }, children: "\uD83C\uDF89" }), _jsx("h1", { style: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }, children: "You're all set!" }), _jsxs("p", { style: { color: '#9ca3af', marginBottom: 40 }, children: ["Welcome to Redbird Pro", data?.email ? `, ${data.email}` : '', ". Your license key has been sent to your email."] }), data?.licenseKey && (_jsxs("div", { style: {
                    background: '#111', border: '1px solid #374151', borderRadius: 16,
                    padding: '24px', marginBottom: 32,
                }, children: [_jsx("p", { style: { fontSize: 12, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "Your license key" }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }, children: [_jsx("code", { style: { fontSize: 15, fontFamily: 'monospace', color: '#e5e7eb', letterSpacing: '0.03em' }, children: data.licenseKey }), _jsx("button", { onClick: copy, style: {
                                    padding: '6px 12px', borderRadius: 8, border: '1px solid #374151',
                                    background: copied ? 'rgba(34,197,94,0.1)' : '#1f2937',
                                    color: copied ? '#22c55e' : '#9ca3af', fontSize: 12, cursor: 'pointer',
                                }, children: copied ? 'Copied!' : 'Copy' })] })] })), _jsxs("div", { style: { background: '#111', border: '1px solid #374151', borderRadius: 16, padding: '20px', marginBottom: 32, textAlign: 'left' }, children: [_jsx("p", { style: { fontSize: 13, fontWeight: 600, marginBottom: 12 }, children: "Add to your Redbird config:" }), _jsx("pre", { style: { fontSize: 12, fontFamily: 'monospace', color: '#a8b5c9', lineHeight: 1.6, overflowX: 'auto' }, children: `createRedbird({
  licenseKey: '${data?.licenseKey ?? 'rb_live_...'}',
  plugins: [stripe({ ... })],
})` })] }), _jsx(Link, { to: "/dashboard", style: {
                    display: 'inline-block', padding: '12px 28px', borderRadius: 12,
                    border: '1px solid #374151', color: '#e5e7eb', fontSize: 14, fontWeight: 500,
                }, children: "Manage my license \u2192" })] }));
}
