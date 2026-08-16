import { formatPrice, pageNumber } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import Image from 'next/image'
import Link from 'next/link'

export default async function HomePage() {
  const products = await trpc.catalog.list.query({ limit: 6, status: 'active' })
  const lead = products[0]
  const rest = products.slice(1)
  const leadImage = (lead?.metadata as { image?: string } | undefined)?.image
  const leadVariant = lead?.variants[0]

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
      {/* ─── Editorial lead ─── */}
      {lead && (
        <article className="grid grid-cols-1 gap-10 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <p className="mb-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] text-ruby">
              <span className="h-px w-10 bg-ruby" />
              Le grand portrait · {pageNumber(1)}
            </p>
            <h2 className="font-serif text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[0.95] tracking-tight text-ivory">
              {lead.name}
              <span className="ml-3 italic text-ivory-muted">— le mois.</span>
            </h2>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-ivory-muted">
              {lead.description}
            </p>
            <div className="mt-12 flex flex-wrap items-baseline gap-6 border-t border-coal-rule pt-6">
              <Link
                href={`/products/${lead.slug}` as never}
                className="group inline-flex items-baseline gap-3 text-sm uppercase tracking-[0.25em] text-ruby hover:text-saffron"
              >
                Lire le portrait
                <span className="inline-block text-base transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              {leadVariant && (
                <span className="font-serif text-3xl text-ivory">
                  {formatPrice(leadVariant.priceAmount, leadVariant.priceCurrency)}
                </span>
              )}
            </div>
          </div>
          {leadImage && (
            <div className="lg:col-span-5">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={leadImage}
                  alt={lead.name}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover grayscale"
                  priority
                />
                <span className="absolute bottom-3 left-3 bg-coal/80 px-3 py-1 font-serif text-xs italic text-ivory backdrop-blur">
                  Cliché №{pageNumber(27)}
                </span>
              </div>
            </div>
          )}
        </article>
      )}

      {/* ─── Pull quote ─── */}
      <section className="border-y border-coal-rule py-20 text-center">
        <p className="pull-quote mx-auto max-w-4xl text-[clamp(2rem,5vw,4rem)] text-ivory">
          « On torréfie petit pour goûter grand —{' '}
          <span className="text-ruby">douze kilos par lot</span>, jamais davantage. »
        </p>
        <p className="mt-8 text-xs uppercase tracking-[0.3em] text-ivory-muted">
          — Marie Léon, maître torréfactrice
        </p>
      </section>

      {/* ─── Index of stories ─── */}
      <section className="py-24">
        <header className="mb-12 flex items-end justify-between gap-6 border-b-[3px] border-ivory pb-4">
          <h2 className="font-serif text-5xl font-medium tracking-tight text-ivory">Au sommaire</h2>
          <span className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">
            {rest.length} entrées
          </span>
        </header>
        <ul>
          {rest.map((product, i) => {
            const image = (product.metadata as { image?: string } | undefined)?.image
            const variant = product.variants[0]
            return (
              <li key={product.id} className="rule-thin">
                <Link
                  href={`/products/${product.slug}` as never}
                  className="group grid grid-cols-12 items-center gap-6 py-8 transition-colors hover:bg-coal-soft"
                >
                  <span className="col-span-1 font-serif text-3xl italic text-ivory-muted tabular">
                    {pageNumber(i + 2)}
                  </span>
                  <div className="col-span-2 hidden md:block">
                    {image && (
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={image}
                          alt={product.name}
                          fill
                          sizes="120px"
                          className="object-cover grayscale transition-all duration-700 group-hover:grayscale-0"
                        />
                      </div>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <h3 className="font-serif text-3xl text-ivory transition-colors group-hover:text-ruby">
                      {product.name}
                    </h3>
                    <p className="mt-2 line-clamp-1 text-sm text-ivory-muted">
                      {product.description}
                    </p>
                  </div>
                  <div className="col-span-12 flex items-baseline justify-end gap-4 md:col-span-3">
                    {variant && (
                      <span className="font-serif text-2xl text-ivory">
                        {formatPrice(variant.priceAmount, variant.priceCurrency)}
                      </span>
                    )}
                    <span className="text-base text-ruby transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
