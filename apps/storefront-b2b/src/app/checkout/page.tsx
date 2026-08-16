import { checkoutAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPriceCompact } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const VAT_RATE = 0.055

export default async function CheckoutPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) redirect('/cart')
  const subtotal = await trpc.cart.subtotal.query({ cartId: cart.id })
  const vat = Math.round(subtotal.amount * VAT_RATE)
  const totalTTC = subtotal.amount + vat

  const field =
    'w-full border border-line bg-white px-3 py-2 text-sm text-graphite outline-none transition-colors focus:border-teal'
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate'

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-teal">Commande</p>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-graphite">Validation</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <form action={checkoutAction} className="space-y-6">
          <section className="space-y-4 border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate">Compte</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className={label}>
                  Email
                </label>
                <input id="email" name="email" type="email" required className={field} />
              </div>
              <div>
                <label htmlFor="company" className={label}>
                  Société
                </label>
                <input id="company" name="company" className={field} />
              </div>
            </div>
            <div>
              <label htmlFor="poNumber" className={label}>
                Référence commande (PO)
              </label>
              <input id="poNumber" name="poNumber" className={field} />
            </div>
          </section>

          <section className="space-y-4 border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate">Livraison</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className={label}>
                  Prénom
                </label>
                <input id="firstName" name="firstName" required className={field} />
              </div>
              <div>
                <label htmlFor="lastName" className={label}>
                  Nom
                </label>
                <input id="lastName" name="lastName" required className={field} />
              </div>
            </div>
            <div>
              <label htmlFor="line1" className={label}>
                Adresse
              </label>
              <input id="line1" name="line1" required className={field} />
            </div>
            <div>
              <label htmlFor="line2" className={label}>
                Complément
              </label>
              <input id="line2" name="line2" className={field} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="postalCode" className={label}>
                  CP
                </label>
                <input id="postalCode" name="postalCode" required className={field} />
              </div>
              <div className="col-span-2">
                <label htmlFor="city" className={label}>
                  Ville
                </label>
                <input id="city" name="city" required className={field} />
              </div>
              <div>
                <label htmlFor="countryCode" className={label}>
                  Pays
                </label>
                <input
                  id="countryCode"
                  name="countryCode"
                  defaultValue="FR"
                  maxLength={2}
                  required
                  className={`${field} uppercase`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="phone" className={label}>
                Téléphone
              </label>
              <input id="phone" name="phone" className={field} />
            </div>
          </section>

          <button
            type="submit"
            className="block w-full bg-teal py-3 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-teal-dark"
          >
            Valider la commande
          </button>
          <p className="text-center">
            <Link href={'/cart' as Route} className="font-mono text-[11px] text-slate hover:text-teal">
              ← Retour au panier
            </Link>
          </p>
        </form>

        <aside className="h-fit border border-line bg-surface p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate">
            Récapitulatif
          </h2>
          <dl className="space-y-2 border-b border-line pb-4 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Sous-total HT</dt>
              <dd className="text-graphite">{formatPriceCompact(subtotal.amount, subtotal.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">TVA (5,5%)</dt>
              <dd className="text-graphite">{formatPriceCompact(vat, subtotal.currency)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between font-mono text-base font-semibold text-graphite">
            <span>Total TTC</span>
            <span>{formatPriceCompact(totalTTC, subtotal.currency)}</span>
          </div>
          <p className="mt-4 font-mono text-[11px] text-slate">Règlement à 30 jours fin de mois</p>
        </aside>
      </div>
    </div>
  )
}
