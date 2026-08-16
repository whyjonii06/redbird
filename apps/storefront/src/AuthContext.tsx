import type { AppRouter } from '@redbirdshop/api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readLocalStorage } from './ssrSafe.js'

type Customer = inferRouterOutputs<AppRouter>['customers']['me']

type AuthState = {
  token: string | null
  customer: Customer | null
  login(token: string, customer: Customer): void
  logout(): void
}

const AuthContext = createContext<AuthState>({
  token: null,
  customer: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always starts logged-out. SSR has no client localStorage to read, so the
  // client's very first hydration pass has to match that exactly — reading
  // localStorage here (even guarded) would hydrate as a different user than
  // the server rendered, which React treats as a mismatch and discards the
  // whole tree. The effect below picks up the real session immediately after
  // mount instead, the same pattern App.tsx already uses for store meta.
  const [token, setToken] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    setToken(readLocalStorage('rb_token'))
    const raw = readLocalStorage('rb_customer')
    if (raw) {
      try {
        setCustomer(JSON.parse(raw) as Customer)
      } catch {}
    }
  }, [])

  const login = useCallback((t: string, c: Customer) => {
    localStorage.setItem('rb_token', t)
    localStorage.setItem('rb_customer', JSON.stringify(c))
    setToken(t)
    setCustomer(c)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('rb_token')
    localStorage.removeItem('rb_customer')
    setToken(null)
    setCustomer(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, customer, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
