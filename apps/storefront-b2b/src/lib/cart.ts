import { cookies } from 'next/headers'
import { redbird } from './redbird'

const COOKIE = 'redbird_b2b_cart_id'

export async function getOrCreateCart() {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (id) {
    const cart = await redbird.cart.get(id)
    if (cart) return cart
  }
  const cart = await redbird.cart.create({ currency: 'EUR' })
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
  return redbird.cart.get(id)
}
