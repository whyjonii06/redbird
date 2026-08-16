import { checkoutAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPrice } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function CheckoutPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) redirect('/cart')
  const subtotal = await trpc.cart.subtotal.query({ cartId: cart.id })

  const field =
    'w-full border border-ivory/20 bg-transparent px-4 py-3 text-sm text-ivory outline-none transition-colors placeholder:text-ivory-muted focus:border-ruby'
  const label = 'mb-1 block text-[10px] uppercase tracking-[0.3em] text-ivory-muted'

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-ruby">Commande</p>
      <h1 className="mb-12 font-serif text-5xl text-ivory">Régler votre commande</h1>

      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <form action={checkoutAction} className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">Contact</h2>
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <input id="email" name="email" type="email" required className={field} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">Livraison</h2>
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="postalCode" className={label}>
                  Code postal
                </label>
                <input id="postalCode" name="postalCode" required className={field} />
              </div>
              <div className="col-span-2">
                <label htmlFor="city" className={label}>
                  Ville
                </label>
                <input id="city" name="city" required className={field} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="countryCode" className={label}>
                  Pays (ISO)
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
              <div>
                <label htmlFor="phone" className={label}>
                  Téléphone
                </label>
                <input id="phone" name="phone" className={field} />
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="block w-full bg-ruby py-4 text-xs uppercase tracking-[0.3em] text-ivory transition-colors hover:bg-saffron hover:text-coal"
          >
            Confirmer la commande
          </button>
          <p className="text-center">
            <Link
              href={'/cart' as Route}
              className="text-[10px] uppercase tracking-[0.2em] text-ivory-muted hover:text-ruby"
            >
              ← Retour au panier
            </Link>
          </p>
        </form>

        <aside className="h-fit border-[3px] border-ivory p-6">
          <h2 className="mb-4 text-[10px] uppercase tracking-[0.3em] text-ivory-muted">
            Récapitulatif
          </h2>
          <div className="space-y-3 border-b border-ivory/20 pb-4">
            {cart.lineItems.map((li) => (
              <div key={li.id} className="flex justify-between text-sm text-ivory">
                <span className="text-ivory-muted">×{li.quantity}</span>
                <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">Total</span>
            <span className="font-serif text-3xl text-ruby">
              {formatPrice(subtotal.amount, subtotal.currency)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
