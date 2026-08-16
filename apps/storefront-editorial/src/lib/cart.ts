import { cookies } from 'next/headers'
import { trpc } from './trpc'

const COOKIE = 'redbird_editorial_cart_id'

export async function getOrCreateCart() {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (id) {
    const cart = await trpc.cart.get.query({ cartId: id }).catch(() => null)
    if (cart) return cart
  }
  const cart = await trpc.cart.create.mutate({ currency: 'EUR' })
  jar.set(COOKIE, cart.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return { ...cart, lineItems: [] }
}

export async function getCart() {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (!id) return null
  return trpc.cart.get.query({ cartId: id }).catch(() => null)
}
