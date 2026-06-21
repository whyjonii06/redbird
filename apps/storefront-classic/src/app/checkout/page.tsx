import { checkoutAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPrice } from '@/lib/format'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function CheckoutPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) redirect('/cart')

  const currency = cart.currency
  const subtotal = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)

  const field =
    'w-full border border-ink/15 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-copper'
  const label = 'mb-1 block text-xs uppercase tracking-widest text-ink-soft'

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
      <p className="mb-3 text-xs uppercase tracking-widest text-copper">Commande</p>
      <h1 className="mb-10 font-display text-5xl font-medium tracking-tight text-ink">Paiement</h1>

      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        {/* Form */}
        <form action={checkoutAction} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-ink-soft">Contact</h2>
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <input id="email" name="email" type="email" required className={field} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-ink-soft">Livraison</h2>
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
                Complément (optionnel)
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
                  Téléphone (optionnel)
                </label>
                <input id="phone" name="phone" className={field} />
              </div>
            </div>
          </section>

          <button
            type="submit"
            className="w-full bg-ink px-8 py-4 text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
          >
            Confirmer la commande
          </button>
          <p className="text-center text-xs text-ink-soft">
            <Link href="/cart" className="underline hover:text-copper">
              ← Retour au panier
            </Link>
          </p>
        </form>

        {/* Summary */}
        <aside className="h-fit border border-ink/10 bg-paper p-6">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-ink-soft">Récapitulatif</h2>
          <div className="space-y-3 border-b border-ink/10 pb-4">
            {cart.lineItems.map((li) => (
              <div key={li.id} className="flex justify-between text-sm text-ink">
                <span className="text-ink-soft">×{li.quantity}</span>
                <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between font-display text-lg text-ink">
            <span>Total</span>
            <span>{formatPrice(subtotal, currency)}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
