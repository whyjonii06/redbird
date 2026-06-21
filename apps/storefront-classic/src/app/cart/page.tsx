import { removeFromCartAction, updateQuantityAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPrice } from '@/lib/format'
import { redbird } from '@/lib/redbird'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export default async function CartPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-32 text-center lg:px-10">
        <p className="mb-3 text-xs uppercase tracking-widest text-copper">Panier</p>
        <h1 className="font-display text-5xl font-medium tracking-tight text-ink">
          Votre panier est vide.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-ink-soft">
          Explorez le catalogue, choisissez vos origines, vos formats et vos accessoires.
        </p>
        <Link
          href="/products"
          className="mt-12 inline-block bg-ink px-8 py-4 text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
        >
          Voir le catalogue
        </Link>
      </div>
    )
  }

  // Build a map of variant→product/name for display
  const items = await Promise.all(
    cart.lineItems.map(async (li) => {
      const variant = await redbird.db.query.productVariants.findFirst({
        where: (v, { eq }) => eq(v.id, li.variantId),
        with: { product: true },
      })
      return { li, variant }
    }),
  )

  const subtotal = await redbird.cart.subtotal(cart.id)

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <header className="mb-16">
        <p className="mb-3 text-xs uppercase tracking-widest text-copper">Panier</p>
        <h1 className="font-display text-5xl font-medium tracking-tight text-ink">
          {cart.lineItems.length} article{cart.lineItems.length > 1 ? 's' : ''}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ul className="divide-y divide-rule border-y border-rule">
            {items.map(({ li, variant }) => {
              const image = (variant?.product?.metadata as { image?: string })?.image
              return (
                <li key={li.id} className="flex gap-6 py-8">
                  <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden bg-paper-deep">
                    {image && (
                      <Image
                        src={image}
                        alt={variant?.product?.name ?? ''}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="font-display text-2xl text-ink">{variant?.product?.name}</h3>
                      <p className="mt-1 text-sm text-ink-soft">{variant?.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-ink-soft">
                        Réf. {variant?.sku}
                      </p>
                    </div>
                    <div className="flex items-end justify-between">
                      <form action={updateQuantityAction} className="flex items-center gap-3">
                        <input type="hidden" name="cartId" value={cart.id} />
                        <input type="hidden" name="lineItemId" value={li.id} />
                        <label className="flex items-center gap-3">
                          <span className="text-xs uppercase tracking-widest text-ink-soft">
                            Qté
                          </span>
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={li.quantity}
                            className="w-16 border border-rule bg-paper px-3 py-2 text-center font-display text-lg text-ink focus:border-ink focus:outline-none"
                          />
                        </label>
                        <button
                          type="submit"
                          className="text-xs uppercase tracking-widest text-copper underline-offset-4 hover:underline"
                        >
                          Maj
                        </button>
                      </form>

                      <div className="text-right">
                        <div className="font-display text-2xl text-copper">
                          {formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
                        </div>
                        <form action={removeFromCartAction} className="mt-1">
                          <input type="hidden" name="cartId" value={cart.id} />
                          <input type="hidden" name="lineItemId" value={li.id} />
                          <button
                            type="submit"
                            className="text-xs uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-copper hover:underline"
                          >
                            Retirer
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="border border-rule bg-paper-deep p-8">
            <h2 className="font-display text-2xl text-ink">Récapitulatif</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Sous-total</dt>
                <dd className="font-display text-base text-ink">
                  {formatPrice(subtotal.amount, subtotal.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Livraison</dt>
                <dd className="font-display text-base text-ink">À l'étape suivante</dd>
              </div>
            </dl>
            <div className="mt-6 flex items-baseline justify-between border-t border-rule pt-6">
              <span className="text-xs uppercase tracking-widest text-ink-soft">Total</span>
              <span className="font-display text-3xl text-copper">
                {formatPrice(subtotal.amount, subtotal.currency)}
              </span>
            </div>
            <Link
              href={'/checkout' as Route}
              className="mt-8 block w-full bg-ink px-6 py-4 text-center text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
            >
              Passer commande
            </Link>
            <p className="mt-3 text-center text-xs text-ink-soft">Livraison &amp; paiement à l'étape suivante</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
