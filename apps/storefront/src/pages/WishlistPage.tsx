import { Link } from 'react-router-dom'
import type { WishlistProduct } from '../WishlistContext.js'
import { useWishlist } from '../WishlistContext.js'
import { ProductCard, type ProductSummary } from '../components/ProductCard.js'
import { useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'

/** Utilisé pour les anonymes : charge les produits via catalog.list et filtre par IDs. */
function WishlistProductsAnon({ ids }: { ids: string[] }) {
  const { locale } = useI18n()
  const { data } = trpc.catalog.list.useQuery({ limit: 100, locale })
  const wishlisted = data?.filter((p) => ids.includes(p.id)) ?? []

  if (wishlisted.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {wishlisted.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

/** Utilisé pour les connectés : les produits viennent directement du WishlistContext (DB). */
function WishlistProductsDB({ items }: { items: WishlistProduct[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {items.map((product) => (
        <ProductCard key={product.id} product={product as unknown as ProductSummary} />
      ))}
    </div>
  )
}

export function WishlistPage() {
  const { ids, items, clear } = useWishlist()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Wishlist</h1>
        {ids.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Clear all
          </button>
        )}
      </div>

      {ids.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">Your wishlist is empty.</p>
          <Link to="/products" className="bg-[var(--primary)] text-white px-6 py-2 rounded-lg">
            Browse products
          </Link>
        </div>
      ) : items !== null ? (
        <WishlistProductsDB items={items} />
      ) : (
        <WishlistProductsAnon ids={ids} />
      )}
    </div>
  )
}
