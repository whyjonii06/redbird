import { addToCartAction } from '@/app/actions'
import { formatPriceCompact } from '@/lib/format'
import { redbird } from '@/lib/redbird'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ProductSheetPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await redbird.catalog.getProductBySlug(slug)
  if (!product || product.status !== 'active') notFound()
  const image = (product.metadata as { image?: string } | undefined)?.image

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
      {/* Breadcrumb / context */}
      <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-slate">
        <Link href="/catalog" className="hover:text-teal">
          / catalogue
        </Link>
        <span>/</span>
        <span className="text-graphite">{product.slug}</span>
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-teal">Fiche technique</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-graphite">
            {product.name}
          </h1>
        </div>
        <div className="font-mono text-xs text-slate">
          Réf catalogue: <span className="text-graphite">REDBIRD-{product.slug.toUpperCase()}</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Image + tech sheet */}
        <div className="col-span-12 lg:col-span-4">
          {image && (
            <div className="relative aspect-square overflow-hidden border border-line bg-surface">
              <Image
                src={image}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 30vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
          )}
          <dl className="mt-4 border border-line bg-surface text-xs">
            <Row label="Famille" value="Café / spécialité" />
            <Row label="Origine" value="Multi-origine" />
            <Row label="Process" value="Lavé / nature" />
            <Row label="Conditionnement" value="Pochette barrière" />
            <Row label="Conservation" value="14 mois à compter du DLUO" />
            <Row label="HS Code" value="0901.21.00" />
            <Row label="EAN" value="3 700XXXXXXXXX" last />
          </dl>
        </div>

        {/* Variants order grid */}
        <div className="col-span-12 lg:col-span-8">
          <div className="mb-6 border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate">
              Description
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-graphite">{product.description}</p>
          </div>

          <div className="overflow-hidden border border-line bg-surface">
            <table className="data">
              <thead>
                <tr>
                  <th>Conditionnement</th>
                  <th className="font-mono">SKU</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">PU HT</th>
                  <th className="w-40 text-right">Quantité</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="font-medium text-graphite">{variant.name}</td>
                    <td className="font-mono text-slate tabular">{variant.sku}</td>
                    <td className="text-right font-mono tabular text-slate">
                      {variant.inventoryQuantity}
                    </td>
                    <td className="text-right font-mono tabular">
                      {formatPriceCompact(variant.priceAmount, variant.priceCurrency)}
                    </td>
                    <td className="text-right">
                      <form
                        action={addToCartAction}
                        className="flex items-center justify-end gap-2"
                      >
                        <input type="hidden" name="variantId" value={variant.id} />
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          defaultValue="1"
                          className="w-20 border border-line bg-surface px-2 py-1 text-right font-mono text-sm tabular focus:border-teal focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="bg-teal px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white hover:bg-teal-dark"
                        >
                          Ajouter
                        </button>
                      </form>
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 ${last ? '' : 'border-b border-line'}`}
    >
      <dt className="text-slate">{label}</dt>
      <dd className="font-mono text-graphite tabular">{value}</dd>
    </div>
  )
}
