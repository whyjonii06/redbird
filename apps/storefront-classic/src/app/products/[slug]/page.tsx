import { addToCartAction } from '@/app/actions'
import { formatPrice } from '@/lib/format'
import { redbird } from '@/lib/redbird'
import Image from 'next/image'
import { notFound } from 'next/navigation'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await redbird.catalog.getProductBySlug(slug)
  if (!product || product.status !== 'active') notFound()
  const image = (product.metadata as { image?: string })?.image

  return (
    <article className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
        {/* Image */}
        <div className="lg:col-span-7">
          <div className="relative aspect-square overflow-hidden bg-paper-deep">
            {image && (
              <Image
                src={image}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 60vw, 100vw"
                priority
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-5 lg:pt-8">
          <p className="mb-3 text-xs uppercase tracking-widest text-copper">Origine pure</p>
          <h1 className="font-display text-5xl font-medium leading-tight tracking-tight text-ink">
            {product.name}
          </h1>

          <p className="mt-8 text-lg leading-relaxed text-ink-soft">{product.description}</p>

          <div className="mt-12 border-t border-rule pt-10">
            <h2 className="mb-5 text-xs uppercase tracking-widest text-ink-soft">Format</h2>
            <div className="space-y-3">
              {product.variants.map((variant) => (
                <form key={variant.id} action={addToCartAction}>
                  <input type="hidden" name="variantId" value={variant.id} />
                  <input type="hidden" name="quantity" value="1" />
                  <button
                    type="submit"
                    className="group flex w-full items-center justify-between border border-rule bg-paper px-6 py-5 text-left transition-all hover:border-ink hover:bg-paper-deep"
                  >
                    <div>
                      <div className="font-display text-xl text-ink">{variant.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-widest text-ink-soft">
                        Réf. {variant.sku}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-2xl text-copper">
                        {formatPrice(variant.priceAmount, variant.priceCurrency)}
                      </span>
                      <span className="text-xl text-ink-soft transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </button>
                </form>
              ))}
            </div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-px border border-rule bg-rule text-sm">
            <Spec label="Torréfacteur" value="Atelier Pantin" />
            <Spec label="Méthode" value="Tambour 5 kg" />
            <Spec label="Fraîcheur" value="≤ 14 jours" />
            <Spec label="Origine" value="Single-origin" />
          </dl>
        </div>
      </div>
    </article>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-5">
      <dt className="text-xs uppercase tracking-widest text-ink-soft">{label}</dt>
      <dd className="mt-2 font-display text-base text-ink">{value}</dd>
    </div>
  )
}
