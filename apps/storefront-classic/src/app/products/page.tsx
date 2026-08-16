import { ProductCard } from '@/components/ProductCard'
import { trpc } from '@/lib/trpc'

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
    <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <header className="mb-20 max-w-3xl">
        <p className="mb-3 text-xs uppercase tracking-widest text-copper">
          {query ? 'Recherche' : 'Le catalogue complet'}
        </p>
        <h1 className="font-display text-6xl font-medium tracking-tight text-ink">
          {query
            ? `${products.length} résultat${products.length !== 1 ? 's' : ''} pour « ${query} »`
            : `${products.length} cafés et accessoires.`}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-soft">
          Origines uniques, blends signature, accessoires d'extraction triés sur le volet.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
