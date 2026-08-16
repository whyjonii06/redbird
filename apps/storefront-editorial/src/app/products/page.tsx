import { formatPrice, pageNumber } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import Image from 'next/image'
import Link from 'next/link'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim()
  const products = query
    ? await trpc.catalog.search.query({ q: query, limit: 100 })
    : await trpc.catalog.list.query({ limit: 100, status: 'active' })

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-12">
      <header className="mb-12 border-b-[3px] border-ivory pb-6">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-ruby">
          {query ? 'Recherche' : "L'index complet"}
        </p>
        <h1 className="font-serif text-[clamp(3rem,8vw,7rem)] font-medium leading-none tracking-tight text-ivory">
          {query ? `« ${query} »` : 'Catalogue raisonné.'}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product, i) => {
          const image = (product.metadata as { image?: string } | undefined)?.image
          const minPrice = product.variants.reduce(
            (m, v) => (v.priceAmount < m ? v.priceAmount : m),
            Number.POSITIVE_INFINITY,
          )
          const currency = product.variants[0]?.priceCurrency ?? 'EUR'
          return (
            <Link
              key={product.id}
              href={`/products/${product.slug}` as never}
              className="group block"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {image && (
                  <Image
                    src={image}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                  />
                )}
                <span className="absolute left-3 top-3 bg-coal/80 px-3 py-1 font-serif text-xs italic text-ivory backdrop-blur">
                  Page {pageNumber(i + 1)}
                </span>
              </div>
              <div className="mt-5 border-t border-coal-rule pt-4">
                <h2 className="font-serif text-2xl text-ivory transition-colors group-hover:text-ruby">
                  {product.name}
                </h2>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="text-ivory-muted">
                    {product.variants.length > 1
                      ? `${product.variants.length} formats`
                      : '1 format'}
                  </span>
                  <span className="font-serif text-xl text-ivory">
                    {product.variants.length > 1 ? 'dès ' : ''}
                    {formatPrice(minPrice, currency)}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
