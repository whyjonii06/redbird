import { jsx as _jsx } from "react/jsx-runtime";
import { ComingSoon } from './pages/ComingSoon.js';
// ── Public site temporarily masked behind a "Coming soon" page ──────────────
// The real site (landing + pricing + marketplace) is preserved — restore it by
// reinstating the routing below. Page components live in ./pages/*.
//
// import { Route, Routes } from 'react-router-dom'
// import { Nav } from './Nav.js'
// import { LandingPage } from './pages/LandingPage.js'
// import { PricingPage } from './pages/PricingPage.js'
// import { SuccessPage } from './pages/SuccessPage.js'
// import { DashboardPage } from './pages/DashboardPage.js'
//
// export function App() {
//   return (
//     <>
//       <Nav />
//       <Routes>
//         <Route path="/" element={<LandingPage />} />
//         <Route path="/pricing" element={<PricingPage />} />
//         <Route path="/success" element={<SuccessPage />} />
//         <Route path="/dashboard" element={<DashboardPage />} />
//       </Routes>
//     </>
//   )
// }
export function App() {
    return _jsx(ComingSoon, {});
}
