import { createContext, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { type StoreMeta, applyBranding, fetchMeta } from './meta'
import { Cart } from './pages/Cart'
import { Home } from './pages/Home'
import { Product } from './pages/Product'

const MetaContext = createContext<StoreMeta>({
  storeName: 'My Store',
  currency: 'EUR',
  branding: {},
})
export const useMeta = () => useContext(MetaContext)

export function App() {
  const [meta, setMeta] = useState<StoreMeta | null>(null)

  useEffect(() => {
    fetchMeta().then((m) => {
      setMeta(m)
      applyBranding(m)
    })
  }, [])

  if (!meta) return null

  return (
    <MetaContext.Provider value={meta}>
      <BrowserRouter>
        <header className="border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="font-bold text-lg">
              {meta.storeName}
            </Link>
            <Link to="/cart" className="text-sm font-medium hover:underline">
              Cart
            </Link>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products/:slug" element={<Product />} />
            <Route path="/cart" element={<Cart />} />
          </Routes>
        </main>
      </BrowserRouter>
    </MetaContext.Provider>
  )
}
