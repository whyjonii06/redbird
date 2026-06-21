import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Route, Routes } from 'react-router-dom';
import { Nav } from './Nav.js';
import { LandingPage } from './pages/LandingPage.js';
import { PricingPage } from './pages/PricingPage.js';
import { SuccessPage } from './pages/SuccessPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
export function App() {
    return (_jsxs(_Fragment, { children: [_jsx(Nav, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/pricing", element: _jsx(PricingPage, {}) }), _jsx(Route, { path: "/success", element: _jsx(SuccessPage, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(DashboardPage, {}) })] })] }));
}
