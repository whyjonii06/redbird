// Minimal cart helper — stores the cart id in localStorage.
// Own this file: swap for a context, server-side session, etc.
const KEY = 'rb_cart'

export const getCartId = (): string | null => localStorage.getItem(KEY)
export const setCartId = (id: string): void => localStorage.setItem(KEY, id)
export const clearCart = (): void => localStorage.removeItem(KEY)
