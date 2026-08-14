import type { AppRouter } from '@redbirdshop/api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { Link } from 'react-router-dom'
import { useMeta } from '../App.js'
import { useAuth } from '../AuthContext.js'
import { useCurrency } from '../CurrencyContext.js'
import { useWishlist } from '../WishlistContext.js'
import { fmt, trpc } from '../trpc.js'

type RouterOutput = inferRouterOutputs<AppRouter>
export type ProductSummary = RouterOutput['catalog']['list'][number]

type Props = { product: ProductSummary }

export function ProductCard({ product }: Props) {
  const { toggle, has } = useWishlist()
  const { customer } = useAuth()
  const meta = useMeta()
  const { currency, convert } = useCurrency()
  const displayPrice = (amount: number, from: string) => fmt(convert(amount, from), currency)
  const cover = product.images[0]
  const cheapestVariant =
    product.variants.length > 0
      ? product.variants.reduce(
          (min, v) => (v.priceAmount < min.priceAmount ? v : min),
          product.variants[0]!,
        )
      : null

  const { data: groupPrice } = trpc.checkout.groupPrice.useQuery(
    { variantId: cheapestVariant?.id ?? '' },
    { enabled: !!customer && !!cheapestVariant?.id },
  )

  return (
    <div className="group relative block">
      <Link to={`/products/${product.slug}`} className="block">
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow">
          <div className="aspect-square bg-gray-100 overflow-hidden relative">
            {cover ? (
              <img
                src={cover.url}
                alt={cover.alt ?? product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg
                  aria-hidden="true"
                  className="w-12 h-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
              {product.name}
            </p>
            <div className="mt-1">
              {groupPrice &&
              cheapestVariant &&
              groupPrice.priceAmount < cheapestVariant.priceAmount ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--primary)' }}>
                      {displayPrice(groupPrice.priceAmount, groupPrice.priceCurrency)}
                    </span>
                    <span className="text-xs line-through text-gray-400">
                      {displayPrice(cheapestVariant.priceAmount, cheapestVariant.priceCurrency)}
                    </span>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded text-white"
                      style={{ background: 'var(--primary)', opacity: 0.85 }}
                    >
                      Member
                    </span>
                  </div>
                  {meta.priceDisplay !== 'none' && (
                    <p className="text-xs text-gray-400">
                      {meta.priceDisplay === 'incl_tax' ? 'Tax incl.' : 'Excl. tax'}
                    </p>
                  )}
                </>
              ) : cheapestVariant ? (
                <>
                  <p className="font-semibold text-sm text-gray-900">
                    {displayPrice(cheapestVariant.priceAmount, cheapestVariant.priceCurrency)}
                  </p>
                  {meta.priceDisplay !== 'none' && (
                    <p className="text-xs text-gray-400">
                      {meta.priceDisplay === 'incl_tax' ? 'Tax incl.' : 'Excl. tax'}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
      {/* Wishlist toggle — outside the Link so it doesn't navigate */}
      <button
        type="button"
        onClick={() => toggle(product.id)}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
        aria-label={has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <svg
          aria-hidden="true"
          className="w-4 h-4"
          fill={has(product.id) ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: has(product.id) ? '#ef4444' : undefined }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </button>
    </div>
  )
}
