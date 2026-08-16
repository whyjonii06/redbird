import { formatPrice } from '@/lib/format'
import type { AppRouter } from '@redbirdshop/api-types'
import type { inferRouterOutputs } from '@trpc/server'
import Image from 'next/image'
import Link from 'next/link'

type RouterOutput = inferRouterOutputs<AppRouter>
export type ProductSummary = RouterOutput['catalog']['list'][number]

export function ProductCard({ product }: { product: ProductSummary }) {
  const firstVariant = product.variants[0]
  const image = (product.metadata as { image?: string })?.image
  const minPrice = product.variants.reduce(
    (min, v) => (v.priceAmount < min ? v.priceAmount : min),
    Number.POSITIVE_INFINITY,
  )
  const currency = firstVariant?.priceCurrency ?? 'EUR'

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-4 transition-opacity hover:opacity-95"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
        {image && (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1 text-[10px] uppercase tracking-widest text-ink backdrop-blur">
          {product.variants.length > 1 ? `${product.variants.length} formats` : 'Disponible'}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl text-ink">{product.name}</h3>
        <span className="font-display text-lg text-copper">
          {product.variants.length > 1 ? 'dès ' : ''}
          {formatPrice(minPrice, currency)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-ink-soft">{product.description}</p>
    </Link>
  )
}
