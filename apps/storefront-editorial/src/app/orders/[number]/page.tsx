import { formatPrice } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import type { Route } from 'next'
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
  const found = await trpc.checkout.getByNumber.query({ number }).catch(() => null)
  if (!found) notFound()

  let order = found
  if (cs && order.status === 'pending') {
    const confirmed = await trpc.checkout.confirmStripeCheckoutSession
      .mutate({ orderId: order.id, sessionId: cs })
      .catch(() => null)
    if (confirmed) order = confirmed
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center lg:px-10">
      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-ruby">Merci</p>
      <h1 className="font-serif text-5xl text-ivory">Commande confirmée</h1>
      <p className="mx-auto mt-6 max-w-md text-ivory-muted">
        Votre commande <span className="text-ivory">{order.number}</span> a bien été enregistrée.
        Une confirmation a été envoyée à {order.customerEmail}.
      </p>

      <div className="mx-auto mt-12 max-w-md border-[3px] border-ivory p-6 text-left">
        <div className="space-y-3 border-b border-ivory/20 pb-4">
          {order.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between text-sm text-ivory">
              <span className="text-ivory-muted">×{li.quantity}</span>
              <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">Total</span>
          <span className="font-serif text-3xl text-ruby">
            {formatPrice(order.totalAmount, order.currency)}
          </span>
        </div>
      </div>

      <Link
        href={'/products' as Route}
        className="mt-12 inline-block bg-ruby px-8 py-4 text-xs uppercase tracking-[0.3em] text-ivory transition-colors hover:bg-saffron hover:text-coal"
      >
        Continuer
      </Link>
    </div>
  )
}
