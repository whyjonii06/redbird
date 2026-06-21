import { formatPriceCompact } from '@/lib/format'
import { redbird } from '@/lib/redbird'
import Image from 'next/image'
import Link from 'next/link'

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim()
  const products = query
    ? await redbird.catalog.search(query, { limit: 100 })
    : await redbird.catalog.listProducts({ limit: 100, status: 'active' })

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-graphite">
            {query
              ? `« ${query} » · ${products.length} résultat${products.length !== 1 ? 's' : ''}`
              : `Catalogue · ${products.length} références`}
          </h1>
          <p className="mt-1 text-sm text-slate">
            Cliquez sur une fiche produit pour voir les caractéristiques techniques complètes.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <table className="data">
          <thead>
            <tr>
              <th className="w-20">Visuel</th>
              <th>Produit</th>
              <th>Description</th>
              <th className="text-center">Variantes</th>
              <th className="text-right">Dès</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const image = (product.metadata as { image?: string } | undefined)?.image
              const minPrice = product.variants.reduce(
                (m, v) => (v.priceAmount < m ? v.priceAmount : m),
                Number.POSITIVE_INFINITY,
              )
              const currency = product.variants[0]?.priceCurrency ?? 'EUR'
              return (
                <tr key={product.id}>
                  <td>
                    <div className="relative h-14 w-14 overflow-hidden border border-line">
                      {image && (
                        <Image
                          src={image}
                          alt={product.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/catalog/${product.slug}`}
                      className="font-medium text-graphite hover:text-teal"
                    >
                      {product.name}
                    </Link>
                    <div className="font-mono text-[11px] text-slate">slug:{product.slug}</div>
                  </td>
                  <td className="max-w-md">
                    <span className="line-clamp-2 text-slate">{product.description}</span>
                  </td>
                  <td className="text-center font-mono tabular text-slate">
                    {product.variants.length}
                  </td>
                  <td className="text-right font-mono tabular">
                    {formatPriceCompact(minPrice, currency)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/catalog/${product.slug}`}
                      className="text-xs font-medium uppercase tracking-wider text-teal hover:underline"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
