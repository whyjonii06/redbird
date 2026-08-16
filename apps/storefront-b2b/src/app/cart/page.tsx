import { removeFromCartAction } from '@/app/actions'
import { getCart } from '@/lib/cart'
import { formatPriceCompact } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import type { Route } from 'next'
import Link from 'next/link'

const VAT_RATE = 0.055 // 5.5% TVA reduced rate for coffee

export default async function CartPage() {
  const cart = await getCart()
  if (!cart || cart.lineItems.length === 0) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-20 text-center lg:px-10">
        <p className="font-mono text-xs uppercase tracking-widest text-teal">Panier</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-graphite">
          Aucune ligne au panier.
        </h1>
        <Link
          href="/"
          className="mt-8 inline-block bg-teal px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-teal-dark"
        >
          Saisir une commande
        </Link>
      </div>
    )
  }

  const subtotal = await trpc.cart.subtotal.query({ cartId: cart.id })
  const vat = Math.round(subtotal.amount * VAT_RATE)
  const totalTTC = subtotal.amount + vat

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-teal">
            Bon de commande N° BC-{cart.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-graphite">
            {cart.lineItems.length} ligne{cart.lineItems.length > 1 ? 's' : ''} de commande
          </h1>
        </div>
        <div className="font-mono text-xs text-slate">
          Émis le {new Date().toLocaleDateString('fr-FR')} · Livraison D+2
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="overflow-hidden border border-line bg-surface">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Produit</th>
                  <th>Conditionnement</th>
                  <th className="font-mono">SKU</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">PU HT</th>
                  <th className="text-right">Total HT</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {cart.lineItems.map((li, i) => (
                  <tr key={li.id}>
                    <td className="font-mono text-slate tabular">
                      {String(i + 1).padStart(3, '0')}
                    </td>
                    <td className="font-medium text-graphite">{li.productName}</td>
                    <td className="text-slate">{li.variantName}</td>
                    <td className="font-mono text-slate tabular">{li.sku}</td>
                    <td className="text-right font-mono tabular">{li.quantity}</td>
                    <td className="text-right font-mono tabular text-slate">
                      {formatPriceCompact(li.unitPriceAmount, li.unitPriceCurrency)}
                    </td>
                    <td className="text-right font-mono tabular font-semibold">
                      {formatPriceCompact(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
                    </td>
                    <td className="text-right">
                      <form action={removeFromCartAction}>
                        <input type="hidden" name="cartId" value={cart.id} />
                        <input type="hidden" name="lineItemId" value={li.id} />
                        <button
                          type="submit"
                          className="font-mono text-xs text-slate hover:text-teal"
                        >
                          [×]
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate">Totaux</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Line
                label="Sous-total HT"
                value={formatPriceCompact(subtotal.amount, subtotal.currency)}
              />
              <Line label="TVA (5,5%)" value={formatPriceCompact(vat, subtotal.currency)} />
              <Line
                label="Total TTC"
                value={formatPriceCompact(totalTTC, subtotal.currency)}
                strong
              />
            </dl>
            <Link
              href={'/checkout' as Route}
              className="mt-6 block w-full bg-teal py-3 text-center text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-teal-dark"
            >
              Valider la commande
            </Link>
            <p className="mt-2 text-center font-mono text-[11px] text-slate">
              Règlement à 30 jours fin de mois
            </p>
          </div>

          <div className="mt-4 border border-line bg-surface-alt p-5 font-mono text-xs text-slate">
            <div>
              Compte : <span className="text-graphite">B2B-DEMO-001</span>
            </div>
            <div>
              Délai : <span className="text-graphite">D+2 ouvré</span>
            </div>
            <div>
              Transporteur : <span className="text-graphite">Chronopost B2B</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        strong ? 'mt-3 border-t border-line pt-3 font-semibold' : ''
      }`}
    >
      <dt className="text-slate">{label}</dt>
      <dd className={`font-mono tabular ${strong ? 'text-base text-teal' : 'text-graphite'}`}>
        {value}
      </dd>
    </div>
  )
}
