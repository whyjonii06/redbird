import { formatPriceCompact } from '@/lib/format'
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
    <div className="mx-auto max-w-2xl px-6 py-20 lg:px-10">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-teal">Confirmation</p>
      <h1 className="text-3xl font-semibold tracking-tight text-graphite">
        Commande {order.number} validée
      </h1>
      <p className="mt-3 text-sm text-slate">
        Un accusé de réception a été envoyé à {order.customerEmail}. Règlement à 30 jours fin de mois.
      </p>

      <div className="mt-8 border border-line bg-surface p-5">
        <dl className="space-y-2 border-b border-line pb-4 font-mono text-sm">
          {order.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between">
              <dt className="text-slate">×{li.quantity}</dt>
              <dd className="text-graphite">
                {formatPriceCompact(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-between font-mono text-base font-semibold text-graphite">
          <span>Total</span>
          <span>{formatPriceCompact(order.totalAmount, order.currency)}</span>
        </div>
      </div>

      <Link
        href={'/catalog' as Route}
        className="mt-8 inline-block bg-teal px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-teal-dark"
      >
        Retour au catalogue
      </Link>
    </div>
  )
}
