// Stripe Checkout (hosted) — zero-dependency, via Stripe's REST API.
// Enabled when STRIPE_SECRET_KEY is set; otherwise the storefront falls back to
// creating the order without online capture.
const STRIPE_API = 'https://api.stripe.com/v1'
const secretKey = () => process.env.STRIPE_SECRET_KEY

export const isStripeEnabled = (): boolean => Boolean(secretKey())

export async function createCheckoutSession(
  order: { orderId: string; orderNumber: string; amount: number; currency: string; customerEmail: string },
  baseUrl: string,
): Promise<string | null> {
  const sk = secretKey()
  if (!sk) return null
  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', `${baseUrl}/orders/${order.orderNumber}?cs={CHECKOUT_SESSION_ID}`)
  body.set('cancel_url', `${baseUrl}/checkout`)
  body.set('customer_email', order.customerEmail)
  body.set('client_reference_id', order.orderId)
  body.set('line_items[0][quantity]', '1')
  body.set('line_items[0][price_data][currency]', order.currency.toLowerCase())
  body.set('line_items[0][price_data][unit_amount]', String(order.amount))
  body.set('line_items[0][price_data][product_data][name]', `Commande ${order.orderNumber}`)
  body.set('metadata[orderId]', order.orderId)

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const session = (await res.json()) as { url?: string }
  return session.url ?? null
}

/** Verify a completed Checkout Session really paid (called on the return URL). */
export async function isSessionPaid(sessionId: string): Promise<boolean> {
  const sk = secretKey()
  if (!sk) return false
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${sk}` },
  })
  if (!res.ok) return false
  const session = (await res.json()) as { payment_status?: string }
  return session.payment_status === 'paid'
}
