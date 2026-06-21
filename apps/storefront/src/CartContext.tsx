import { createContext, useCallback, useContext, useState } from 'react'
import { trpc } from './trpc.js'

const CART_KEY = 'redbird_cart'

type CartCtx = {
  cartId: string | null
  setCartId: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartCtx>({
  cartId: null,
  setCartId: () => {},
  clearCart: () => {},
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartId, _setCartId] = useState<string | null>(() => localStorage.getItem(CART_KEY))

  const setCartId = useCallback((id: string) => {
    localStorage.setItem(CART_KEY, id)
    _setCartId(id)
  }, [])

  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_KEY)
    _setCartId(null)
  }, [])

  return (
    <CartContext.Provider value={{ cartId, setCartId, clearCart }}>{children}</CartContext.Provider>
  )
}

export function useCartContext() {
  return useContext(CartContext)
}

export function useCartData() {
  const { cartId } = useCartContext()
  return trpc.cart.get.useQuery({ cartId: cartId! }, { enabled: !!cartId })
}

export function useAddToCart() {
  const { cartId, setCartId } = useCartContext()
  const utils = trpc.useUtils()
  const createCart = trpc.cart.create.useMutation()
  const addItemMutation = trpc.cart.addItem.useMutation()

  return useCallback(
    async (variantId: string, currency: string, quantity = 1) => {
      let id = cartId
      if (!id) {
        const cart = await createCart.mutateAsync({ currency })
        id = cart.id
        setCartId(id)
      }
      try {
        await addItemMutation.mutateAsync({ cartId: id, variantId, quantity })
      } catch (err) {
        // Cart was checked_out or abandoned — create a fresh one and retry
        if (err instanceof Error && err.message.includes('not active')) {
          const cart = await createCart.mutateAsync({ currency })
          id = cart.id
          setCartId(id)
          await addItemMutation.mutateAsync({ cartId: id, variantId, quantity })
        } else {
          throw err
        }
      }
      await utils.cart.get.invalidate()
    },
    [cartId, setCartId, createCart, addItemMutation, utils],
  )
}
