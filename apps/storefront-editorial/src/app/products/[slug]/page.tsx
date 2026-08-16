import { addToCartAction } from '@/app/actions'
import { formatPrice, pageNumber } from '@/lib/format'
import { trpc } from '@/lib/trpc'
import Image from 'next/image'
import { notFound } from 'next/navigation'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await trpc.catalog.bySlug.query({ slug }).catch(() => null)
  if (!product || product.status !== 'active') notFound()
  const image = (product.metadata as { image?: string } | undefined)?.image

  return (
    <article className="mx-auto max-w-[1400px] px-6 py-12 lg:px-12">
      {/* Title block — magazine spread */}
      <header className="grid grid-cols-12 items-end gap-6 border-b-[3px] border-ivory pb-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-ruby">
            <span className="font-serif text-xl italic tabular">{pageNumber(42)}</span>
            <span className="h-px w-8 bg-ruby" />
            Le grand portrait
          </p>
          <h1 className="font-serif text-[clamp(3rem,9vw,8rem)] font-medium leading-[0.9] tracking-tight text-ivory">
            {product.name}.
          </h1>
        </div>
        <div className="col-span-12 lg:col-span-4 lg:text-right">
          <p className="font-serif text-xl italic text-ivory-muted">Sommaire / fiche</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-ivory-muted">
            Vol. XXVII · Juin 2026
          </p>
        </div>
      </header>

      {/* Lede + image */}
      <div className="grid grid-cols-12 gap-10 py-16">
        <div className="col-span-12 lg:col-span-5">
          {image && (
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={image}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
          )}
          <p className="mt-3 font-serif text-sm italic text-ivory-muted">
            Cliché №{pageNumber(27)} — Studio Pantin
          </p>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <p className="pull-quote text-[clamp(1.75rem,3vw,3rem)] text-ivory">
            {product.description?.split('.')[0]}.
          </p>

          <p className="mt-12 text-lg leading-relaxed text-ivory-muted">{product.description}</p>

          {/* Variants — magazine sidebar look */}
          <div className="mt-12 border-t-[3px] border-ivory pt-6">
            <h2 className="mb-6 text-xs uppercase tracking-[0.3em] text-ruby">Conditionnements</h2>
            <div className="space-y-3">
              {product.variants.map((variant) => (
                <form key={variant.id} action={addToCartAction}>
                  <input type="hidden" name="variantId" value={variant.id} />
                  <input type="hidden" name="quantity" value="1" />
                  <button
                    type="submit"
                    className="group flex w-full items-baseline justify-between gap-6 border-b border-coal-rule py-4 text-left transition-colors hover:bg-coal-soft"
                  >
                    <div className="flex items-baseline gap-5">
                      <span className="font-serif text-2xl text-ivory-muted italic">
                        №{variant.sku.split('-')[1] ?? '01'}
                      </span>
                      <div>
                        <div className="font-serif text-2xl text-ivory transition-colors group-hover:text-ruby">
                          {variant.name}
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                          Réf. {variant.sku}
                        </div>
                      </div>
                    </div>
                    <span className="font-serif text-3xl text-ivory group-hover:text-saffron">
                      {formatPrice(variant.priceAmount, variant.priceCurrency)}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
