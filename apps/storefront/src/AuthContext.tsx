import type { AppRouter } from '@redbirdshop/api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { createContext, useCallback, useContext, useState } from 'react'

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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rb_token'))
  const [customer, setCustomer] = useState<Customer | null>(() => {
    const raw = localStorage.getItem('rb_customer')
    try {
      return raw ? (JSON.parse(raw) as Customer) : null
    } catch {
      return null
    }
  })

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
