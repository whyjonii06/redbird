import { bulkAddAction } from '@/app/actions'
import { formatPriceCompact } from '@/lib/format'
import { trpc } from '@/lib/trpc'

export default async function QuickOrderPage() {
  const products = await trpc.catalog.list.query({ limit: 100, status: 'active' })

  // Flatten variants for the data table
  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({
      productSlug: p.slug,
      productName: p.name,
      variantId: v.id,
      variantName: v.name,
      sku: v.sku,
      priceAmount: v.priceAmount,
      priceCurrency: v.priceCurrency,
      inventoryQuantity: v.inventoryQuantity,
    })),
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
      {/* Page header — utilitarian, no fluff */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-graphite">
            Saisie rapide de commande
          </h1>
          <p className="mt-1 text-sm text-slate">
            Renseignez les quantités, puis validez. Tarifs HT, livraison sous 48h en France
            métropolitaine.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Kpi label="Références" value={String(rows.length)} />
          <Kpi label="Fournisseur" value="REDBIRD-FR" />
          <Kpi label="Compte" value="B2B-DEMO-001" accent />
        </div>
      </header>

      <form action={bulkAddAction}>
        <div className="overflow-x-auto rounded-sm border border-line bg-surface">
          <table className="data">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Produit</th>
                <th>Conditionnement</th>
                <th className="font-mono">SKU</th>
                <th className="text-right">Stock</th>
                <th className="text-right">PU HT</th>
                <th className="w-32 text-right">Quantité</th>
                <th className="w-32 text-right">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.variantId}>
                  <td className="font-mono text-slate tabular">{String(i + 1).padStart(3, '0')}</td>
                  <td>
                    <a
                      href={`/catalog/${row.productSlug}`}
                      className="font-medium text-graphite hover:text-teal"
                    >
                      {row.productName}
                    </a>
                  </td>
                  <td className="text-slate">{row.variantName}</td>
                  <td className="font-mono text-slate tabular">{row.sku}</td>
                  <td className="text-right font-mono tabular text-slate">
                    {row.inventoryQuantity}
                  </td>
                  <td className="text-right font-mono tabular">
                    {formatPriceCompact(row.priceAmount, row.priceCurrency)}
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      name={`qty_${row.variantId}`}
                      min="0"
                      defaultValue="0"
                      className="w-20 border border-line bg-surface px-2 py-1 text-right font-mono text-sm tabular focus:border-teal focus:outline-none"
                    />
                  </td>
                  <td className="text-right font-mono text-slate tabular">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <p className="font-mono text-xs text-slate">
            Astuce — quantités à 0 ignorées. Aucun minimum de commande sur les références
            disponibles.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="reset"
              className="border border-line bg-surface px-4 py-2 text-xs font-medium text-graphite hover:bg-surface-alt"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              className="bg-teal px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-teal-dark"
            >
              Ajouter au panier
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Kpi({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex items-baseline gap-2 border px-3 py-1 ${
        accent ? 'border-teal text-teal' : 'border-line text-graphite'
      }`}
    >
      <span className="text-[10px] uppercase tracking-widest text-slate">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  )
}
