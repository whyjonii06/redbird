import { formatPrice } from '@/lib/format'
import { redbird } from '@/lib/redbird'
import { isSessionPaid } from '@/lib/stripe'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>
  searchParams: Promise<{ cs?: string }>
}) {
  const { number } = await params
  const { cs } = await searchParams
  let order = await redbird.orders.getByNumber(number)
  if (!order) notFound()

  // Returning from Stripe Checkout: verify the session paid, then mark paid.
  if (cs && order.status === 'pending' && (await isSessionPaid(cs))) {
    await redbird.orders.markPaid(order.id)
    order = (await redbird.orders.getByNumber(number)) ?? order
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center lg:px-10">
      <p className="mb-3 text-xs uppercase tracking-widest text-copper">Merci</p>
      <h1 className="font-display text-5xl font-medium tracking-tight text-ink">
        Commande confirmée
      </h1>
      <p className="mx-auto mt-6 max-w-md text-lg text-ink-soft">
        Votre commande <span className="text-ink">{order.number}</span> a bien été enregistrée. Un
        email de confirmation a été envoyé à {order.customerEmail}.
      </p>

      <div className="mx-auto mt-12 max-w-md border border-ink/10 bg-paper p-6 text-left">
        <div className="space-y-3 border-b border-ink/10 pb-4">
          {order.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between text-sm text-ink">
              <span className="text-ink-soft">×{li.quantity}</span>
              <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between font-display text-lg text-ink">
          <span>Total</span>
          <span>{formatPrice(order.totalAmount, order.currency)}</span>
        </div>
      </div>

      <Link
        href="/products"
        className="mt-12 inline-block bg-ink px-8 py-4 text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
      >
        Continuer mes achats
      </Link>
    </div>
  )
}
