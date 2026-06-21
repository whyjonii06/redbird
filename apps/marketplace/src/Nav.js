import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
export function Nav() {
    const { pathname } = useLocation();
    return (_jsxs("nav", { style: {
            position: 'sticky', top: 0, zIndex: 50,
            background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #1f2937',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 2rem', height: 56,
        }, children: [_jsxs(Link, { to: "/", style: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17, letterSpacing: '-0.03em' }, children: [_jsx("img", { src: "/favicon.svg", alt: "", style: { width: 20, height: 20 } }), " redbird"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 24 }, children: [_jsx(Link, { to: "/pricing", style: { fontSize: 14, color: pathname === '/pricing' ? '#fff' : '#9ca3af', fontWeight: 500 }, children: "Pricing" }), _jsx(Link, { to: "/dashboard", style: { fontSize: 14, color: pathname === '/dashboard' ? '#fff' : '#9ca3af', fontWeight: 500 }, children: "My license" }), _jsx(Link, { to: "/pricing", style: {
                            fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 8,
                            background: '#e8302a', color: '#fff',
                        }, children: "Get Pro \u2192" })] })] }));
}
