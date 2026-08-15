import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../App.js'
import { useAuth } from '../AuthContext.js'
import { useAddToCart } from '../CartContext.js'
import { useCurrency } from '../CurrencyContext.js'
import { useWishlist } from '../WishlistContext.js'
import { RedirectOrNotFound } from '../components/RedirectOrNotFound.js'
import { useI18n } from '../i18n/index.js'
import { optimizedSrc, optimizedSrcSet } from '../optimizedImage.js'
import { Slot } from '../slots/registry.js'
import { fmt, trpc } from '../trpc.js'
import { useSeoMeta } from '../useSeoMeta.js'

function StockBadge({ available }: { available: number | null | undefined }) {
  if (available == null) return null
  if (available === 0)
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        Out of stock
      </span>
    )
  if (available <= 5)
    return (
      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        Only {available} left
      </span>
    )
  return (
    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      In stock
    </span>
  )
}

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const { locale } = useI18n()
  const { data: product, isLoading, error } = trpc.catalog.bySlug.useQuery({ slug: slug!, locale })
  const [selectedVariantId, setSelectedVariantId] = useState<string>()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const addToCart = useAddToCart()
  const { toggle, has } = useWishlist()
  const meta = useMeta()
  const { currency, convert } = useCurrency()
  const displayPrice = (amount: number, from: string) => fmt(convert(amount, from), currency)

  // Reset gallery when navigating between products
  useEffect(() => {
    setActiveImageIdx(0)
  }, [product?.id])

  // Close lightbox with Escape key
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen])

  // SEO: document meta + JSON-LD Product schema on product load
  const firstVariant = product?.variants[0]
  useSeoMeta(
    product
      ? {
          title: product.metaTitle ?? product.name,
          description: product.metaDescription ?? product.description?.slice(0, 160) ?? '',
          ogType: 'product',
          ogImage: product.images[0]?.url,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            ...(product.description ? { description: product.description } : {}),
            image: product.images.map((img) => img.url),
            ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
            ...(firstVariant
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: (firstVariant.priceAmount / 100).toFixed(2),
                    priceCurrency: firstVariant.priceCurrency,
                    availability:
                      (firstVariant.stockLevel?.available ?? 1) > 0
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/OutOfStock',
                  },
                }
              : {}),
          },
        }
      : undefined,
  )

  const { customer } = useAuth()

  const variant =
    (selectedVariantId ? product?.variants.find((v) => v.id === selectedVariantId) : undefined) ??
    product?.variants[0]

  const { data: groupPrice } = trpc.checkout.groupPrice.useQuery(
    { variantId: variant?.id ?? '', quantity: qty },
    { enabled: !!variant?.id && !!customer },
  )
  const { data: tierData } = trpc.customers.tierPricing.useQuery(
    { productId: product?.id ?? '' },
    { enabled: !!product?.id && !!customer },
  )
  const tiers = tierData?.find((t) => t.variantId === variant?.id)?.tiers ?? []

  async function handleAddToCart() {
    if (!variant) return
    await addToCart(variant.id, currency, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const [subInterval, setSubInterval] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [subPaymentMethodId, setSubPaymentMethodId] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const { data: paymentMethods = [] } = trpc.paymentMethods.list.useQuery(undefined, {
    enabled: Boolean(customer),
  })
  const subscribeMut = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      setSubscribed(true)
      setTimeout(() => setSubscribed(false), 3000)
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-100 rounded-xl w-3/4 animate-pulse" />
            <div className="h-6 bg-gray-100 rounded-xl w-1/4 animate-pulse" />
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <RedirectOrNotFound
        fallback={
          <div className="max-w-6xl mx-auto px-4 py-24 text-center">
            <p className="text-xl font-semibold text-gray-900 mb-2">Product not found</p>
            <Link to="/products" className="text-sm" style={{ color: 'var(--primary)' }}>
              ← Back to products
            </Link>
          </div>
        }
      />
    )
  }

  const images = product.images.length > 0 ? product.images : null
  const activeImage = images?.[activeImageIdx] ?? images?.[0]
  const stock = variant?.stockLevel

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link
        to="/products"
        className="text-sm mb-6 inline-block"
        style={{ color: 'var(--primary)' }}
      >
        ← Back to products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
            {activeImage ? (
              <button
                type="button"
                aria-label="Zoom image"
                onClick={() => setLightboxOpen(true)}
                className="block w-full h-full cursor-zoom-in"
              >
                <img
                  src={optimizedSrc(activeImage.url, 800)}
                  srcSet={optimizedSrcSet(activeImage.url, [400, 800, 1200])}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  alt={activeImage.alt ?? product.name}
                  className="w-full h-full object-cover transition-opacity duration-200"
                />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg
                  aria-hidden="true"
                  className="w-16 h-16"
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
          {images && images.length > 1 && (
            <div className="flex gap-2">
              {images.slice(0, 6).map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIdx(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${
                    i === activeImageIdx
                      ? 'border-[var(--primary)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={optimizedSrc(img.url, 128)}
                    alt={img.alt ?? ''}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {product.brand.name}
              </p>
            )}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <button
                type="button"
                onClick={() => toggle(product.id)}
                className="shrink-0 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:border-red-300 transition-colors"
                aria-label={has(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
              >
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill={has(product.id) ? '#ef4444' : 'none'}
                  viewBox="0 0 24 24"
                  stroke={has(product.id) ? '#ef4444' : 'currentColor'}
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
              </button>
            </div>
            {variant && (
              <div className="mt-2">
                {groupPrice && groupPrice.priceAmount < variant.priceAmount ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-2xl font-semibold" style={{ color: 'var(--primary)' }}>
                      {displayPrice(groupPrice.priceAmount, groupPrice.priceCurrency)}
                    </p>
                    <span className="text-lg line-through text-gray-400">
                      {displayPrice(variant.priceAmount, variant.priceCurrency)}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ background: 'var(--primary)' }}
                    >
                      Member price
                    </span>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold" style={{ color: 'var(--primary)' }}>
                    {displayPrice(variant.priceAmount, variant.priceCurrency)}
                  </p>
                )}
                {meta.priceDisplay !== 'none' && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {meta.priceDisplay === 'incl_tax' ? 'Tax included' : 'Excl. tax'}
                  </p>
                )}
              </div>
            )}
            {tiers.length > 1 && (
              <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden max-w-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                        Quantity
                      </th>
                      <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                        Unit price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr
                        key={tier.minQuantity}
                        className={`border-t border-gray-100 ${qty >= tier.minQuantity ? 'bg-indigo-50' : ''}`}
                      >
                        <td className="px-3 py-1.5 text-gray-700">{tier.minQuantity}+</td>
                        <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                          {displayPrice(tier.priceAmount, tier.priceCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {stock && (
              <div className="mt-2">
                <StockBadge available={stock.available} />
              </div>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {product.features && product.features.length > 0 && (
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Specifications</h3>
              <dl className="space-y-2">
                {product.features.map((f) => (
                  <div key={f.id} className="flex gap-3 text-sm">
                    <dt className="w-40 shrink-0 text-gray-500">{f.name}</dt>
                    <dd className="text-gray-900 font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Variant selector */}
          {product.variants.length > 1 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Choose option</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      (selectedVariantId ?? product.variants[0]?.id) === v.id
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {v.name}
                    {v.stockLevel?.available === 0 && (
                      <span className="ml-1 text-xs text-red-400">(sold out)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Quantity</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-lg font-medium hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold text-gray-900">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-lg font-medium hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Add to cart */}
          <button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={!variant || stock?.available === 0}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {stock?.available === 0 ? 'Out of stock' : added ? '✓ Added to cart' : 'Add to cart'}
          </button>

          {variant && <p className="text-xs text-gray-400">SKU: {variant.sku}</p>}

          {/* Subscribe & save — auto-charges a saved card on renewal, or emails a reminder if none is picked */}
          {customer && variant && stock?.available !== 0 && (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Subscribe to this item</p>
              <p className="text-xs text-gray-400 mb-3">
                {paymentMethods.length > 0
                  ? 'Pick a saved card to auto-charge each cycle, or leave it as a reminder email.'
                  : 'Get a reminder email to reorder — add a saved card in your account to enable auto-charge.'}
              </p>
              {paymentMethods.length > 0 && (
                <select
                  value={subPaymentMethodId}
                  onChange={(e) => setSubPaymentMethodId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
                >
                  <option value="">Reminder email only (no auto-charge)</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.brand ?? 'Card'} •••• {pm.last4}
                      {pm.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-3">
                <select
                  value={subInterval}
                  onChange={(e) => setSubInterval(e.target.value as typeof subInterval)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                  <option value="yearly">Every year</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    subscribeMut.mutate({
                      variantId: variant.id,
                      quantity: qty,
                      interval: subInterval,
                      ...(subPaymentMethodId ? { paymentMethodId: subPaymentMethodId } : {}),
                    })
                  }
                  disabled={subscribeMut.isPending}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {subscribeMut.isPending
                    ? 'Subscribing…'
                    : subscribed
                      ? '✓ Subscribed'
                      : 'Subscribe'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Slot name="product.tab" productId={product.id} />
      <RelatedProductsSection productId={product.id} />
      <AlsoBoughtSection productId={product.id} />

      {lightboxOpen && product.images[activeImageIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          role="button"
          tabIndex={0}
          aria-label="Close image viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxOpen(false)
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={optimizedSrc(product.images[activeImageIdx]?.url ?? '', 1600)}
            alt={product.images[activeImageIdx]?.alt ?? product.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
          />
          {/* Prev/Next si plusieurs images */}
          {product.images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveImageIdx((i) => (i - 1 + product.images.length) % product.images.length)
                }}
              >
                ←
              </button>
              <button
                type="button"
                className="absolute right-16 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveImageIdx((i) => (i + 1) % product.images.length)
                }}
              >
                →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

type ProductTeaser = {
  id: string
  slug: string
  name: string
  images: { url: string; alt: string | null }[]
  variants: { priceAmount: number; priceCurrency: string }[]
}

function ProductTeaserGrid({ title, products }: { title: string; products: ProductTeaser[] }) {
  const { currency, convert } = useCurrency()

  if (products.length === 0) return null

  return (
    <div className="mt-16">
      <h2 className="text-xl font-bold text-gray-900 mb-6">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {products.map((p) => {
          const variant = p.variants[0]
          const img = p.images[0]
          return (
            <a key={p.id} href={`/products/${p.slug}`} className="group block">
              <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3">
                {img ? (
                  <img
                    src={optimizedSrc(img.url, 320)}
                    srcSet={optimizedSrcSet(img.url, [160, 320, 480])}
                    sizes="(min-width: 640px) 25vw, 50vw"
                    alt={img.alt ?? p.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg
                      aria-hidden="true"
                      className="w-10 h-10"
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
              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[var(--primary)] transition-colors">
                {p.name}
              </p>
              {variant && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--primary)' }}>
                  {fmt(convert(variant.priceAmount, variant.priceCurrency), currency)}
                </p>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function RelatedProductsSection({ productId }: { productId: string }) {
  const { locale } = useI18n()
  const { data: related = [] } = trpc.catalog.related.useQuery(
    { productId, limit: 4, locale },
    { enabled: Boolean(productId) },
  )

  return <ProductTeaserGrid title="You may also like" products={related} />
}

function AlsoBoughtSection({ productId }: { productId: string }) {
  const { locale } = useI18n()
  const { data: alsoBought = [] } = trpc.catalog.alsoBought.useQuery(
    { productId, limit: 4, locale },
    { enabled: Boolean(productId) },
  )

  return <ProductTeaserGrid title="Customers also bought" products={alsoBought} />
}
