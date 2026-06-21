import type { AppRouter } from '@redbirdshop/api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.js'
import { trpc } from './trpc.js'

type RouterOutput = inferRouterOutputs<AppRouter>
export type WishlistProduct = RouterOutput['customers']['wishlist']['list'][number]

type WishlistState = {
  ids: string[]
  /** Produits complets depuis la DB (uniquement quand connecté). null pour les anonymes. */
  items: WishlistProduct[] | null
  toggle(productId: string): void
  has(productId: string): boolean
  clear(): void
}

const WishlistContext = createContext<WishlistState>({
  ids: [],
  items: null,
  toggle: () => {},
  has: () => false,
  clear: () => {},
})

function loadLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem('rb_wishlist') ?? '[]') as string[]
  } catch {
    return []
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { customer } = useAuth()
  const isLoggedIn = Boolean(customer)

  // ── DB wishlist (authenticated) ──────────────────────────────────────────
  const utils = trpc.useUtils()
  const { data: dbItems = [] } = trpc.customers.wishlist.list.useQuery(undefined, {
    enabled: isLoggedIn,
  })
  const addMut = trpc.customers.wishlist.add.useMutation({
    onSuccess: () => {
      void utils.customers.wishlist.list.invalidate()
    },
  })
  const removeMut = trpc.customers.wishlist.remove.useMutation({
    onSuccess: () => {
      void utils.customers.wishlist.list.invalidate()
    },
  })

  // ── localStorage wishlist (anonymous) ────────────────────────────────────
  const [localIds, setLocalIds] = useState<string[]>(loadLocal)

  // Persist localIds changes
  useEffect(() => {
    localStorage.setItem('rb_wishlist', JSON.stringify(localIds))
  }, [localIds])

  // ── Computed values ───────────────────────────────────────────────────────
  const ids = isLoggedIn ? dbItems.map((p) => p.id) : localIds
  const items: WishlistProduct[] | null = isLoggedIn ? dbItems : null

  const has = useCallback(
    (id: string) => {
      if (isLoggedIn) return dbItems.some((p) => p.id === id)
      return localIds.includes(id)
    },
    [isLoggedIn, dbItems, localIds],
  )

  const toggle = useCallback(
    (id: string) => {
      if (isLoggedIn) {
        if (dbItems.some((p) => p.id === id)) {
          removeMut.mutate({ productId: id })
        } else {
          addMut.mutate({ productId: id })
        }
      } else {
        setLocalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      }
    },
    [isLoggedIn, dbItems, addMut, removeMut],
  )

  const clear = useCallback(() => {
    if (!isLoggedIn) {
      localStorage.removeItem('rb_wishlist')
      setLocalIds([])
    }
  }, [isLoggedIn])

  return (
    <WishlistContext.Provider value={{ ids, items, toggle, has, clear }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  return useContext(WishlistContext)
}
