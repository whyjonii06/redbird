import { removeFromCartAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPrice, pageNumber } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export default async function CartPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-32 text-center lg:px-12">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-ruby">Bon de commande</p>
        <h1 className="font-serif text-[clamp(3rem,7vw,6rem)] font-medium tracking-tight text-ivory">
          Votre carnet est vide.
        </h1>
        <Link
          href="/products"
          className="mt-12 inline-block border border-ivory px-10 py-4 text-xs uppercase tracking-[0.3em] text-ivory transition-colors hover:border-ruby hover:bg-ruby"
        >
          Parcourir l'index
        </Link>
      </div>
    )
  }

  const subtotal = await trpc.cart.subtotal.query({ cartId: cart.id })

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-12 lg:px-12">
      <header className="mb-12 border-b-[3px] border-ivory pb-6">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-ruby">Bon de commande</p>
        <h1 className="font-serif text-[clamp(3rem,8vw,7rem)] font-medium leading-none tracking-tight text-ivory">
          Votre choix.
        </h1>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-ivory-muted tabular">
          {cart.lineItems.length} entrée{cart.lineItems.length > 1 ? 's' : ''} — Page{' '}
          {pageNumber(98)}
        </p>
      </header>

      <div className="grid grid-cols-12 gap-10">
        <ul className="col-span-12 lg:col-span-8">
          {cart.lineItems.map((li, i) => {
            return (
              <li
                key={li.id}
                className="grid grid-cols-12 items-center gap-6 border-b border-coal-rule py-8"
              >
                <span className="col-span-1 font-serif text-2xl italic text-ivory-muted tabular">
                  {pageNumber(i + 1)}
                </span>
                <div className="col-span-2 hidden md:block">
                  {li.image && (
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={li.image}
                        alt={li.productName}
                        fill
                        sizes="100px"
                        className="object-cover grayscale"
                      />
                    </div>
                  )}
                </div>
                <div className="col-span-12 md:col-span-5">
                  <h3 className="font-serif text-2xl text-ivory">{li.productName}</h3>
                  <p className="mt-1 text-sm italic text-ivory-muted">{li.variantName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ivory-muted">
                    Réf. {li.sku} · ×{li.quantity}
                  </p>
                </div>
                <div className="col-span-12 flex items-baseline justify-end gap-6 md:col-span-4">
                  <span className="font-serif text-3xl text-ivory">
                    {formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
                  </span>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="cartId" value={cart.id} />
                    <input type="hidden" name="lineItemId" value={li.id} />
                    <button
                      type="submit"
                      className="text-xs uppercase tracking-[0.2em] text-ivory-muted underline-offset-4 hover:text-ruby hover:underline"
                    >
                      Retirer
                    </button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="col-span-12 lg:col-span-4">
          <div className="border-[3px] border-ivory p-8">
            <h2 className="font-serif text-3xl italic text-ivory">Récapitulatif</h2>
            <dl className="mt-8 space-y-4 text-sm">
              <div className="flex justify-between border-b border-coal-rule pb-3">
                <dt className="text-ivory-muted">Sous-total</dt>
                <dd className="font-serif text-xl text-ivory">
                  {formatPrice(subtotal.amount, subtotal.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ivory-muted">Livraison</dt>
                <dd className="text-xs uppercase tracking-[0.2em] text-ivory-muted">À calculer</dd>
              </div>
            </dl>
            <div className="mt-8 flex items-baseline justify-between border-t-[3px] border-ivory pt-4">
              <span className="text-xs uppercase tracking-[0.3em] text-ivory-muted">Total</span>
              <span className="font-serif text-4xl text-ruby">
                {formatPrice(subtotal.amount, subtotal.currency)}
              </span>
            </div>
            <Link
              href={'/checkout' as Route}
              className="mt-10 block w-full bg-ruby py-4 text-center text-xs uppercase tracking-[0.3em] text-ivory transition-colors hover:bg-saffron hover:text-coal"
            >
              Régler ma commande
            </Link>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-ivory-muted">
              Paiement chiffré · Stripe
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
