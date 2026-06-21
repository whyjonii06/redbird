'use server'

import { getCart, getOrCreateCart } from '@/lib/cart'
import { redbird } from '@/lib/redbird'
import { createCheckoutSession, isStripeEnabled } from '@/lib/stripe'
import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function checkoutAction(formData: FormData) {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) redirect('/cart')

  const customerEmail = String(formData.get('email') ?? '')
  const line2 = String(formData.get('line2') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const shippingAddress = {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    line1: String(formData.get('line1') ?? ''),
    city: String(formData.get('city') ?? ''),
    postalCode: String(formData.get('postalCode') ?? ''),
    countryCode: String(formData.get('countryCode') ?? 'FR').toUpperCase().slice(0, 2),
    ...(line2 ? { line2 } : {}),
    ...(phone ? { phone } : {}),
  }

  const order = await redbird.orders.createFromCart(cart.id, { customerEmail, shippingAddress })
  const jar = await cookies()
  jar.delete('redbird_editorial_cart_id')
  revalidatePath('/cart')

  if (isStripeEnabled()) {
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const host = h.get('host') ?? 'localhost:3002'
    const sessionUrl = await createCheckoutSession(
      {
        orderId: order.id,
        orderNumber: order.number,
        amount: order.totalAmount,
        currency: order.currency,
        customerEmail,
      },
      `${proto}://${host}`,
    )
    if (sessionUrl) redirect(sessionUrl as Route)
  }

  redirect(`/orders/${order.number}` as Route)
}

export async function addToCartAction(formData: FormData) {
  const variantId = String(formData.get('variantId') ?? '')
  const quantity = Number(formData.get('quantity') ?? 1)
  if (!variantId) throw new Error('variantId required')
  const cart = await getOrCreateCart()
  await redbird.cart.addItem(cart.id, variantId, quantity)
  revalidatePath('/cart')
  revalidatePath('/')
  redirect('/cart')
}

export async function removeFromCartAction(formData: FormData) {
  const cartId = String(formData.get('cartId') ?? '')
  const lineItemId = String(formData.get('lineItemId') ?? '')
  await redbird.cart.removeItem(cartId, lineItemId)
  revalidatePath('/cart')
}
