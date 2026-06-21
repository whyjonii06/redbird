import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCartId, setCartId } from '../cart'
import { useMeta } from '../App'
import { fmt, trpc } from '../trpc'

export function Product() {
  const { slug } = useParams<{ slug: string }>()
  const meta = useMeta()
  const navigate = useNavigate()
  const { data: product, isLoading } = trpc.catalog.bySlug.useQuery({ slug: slug! })

  const createCart = trpc.cart.create.useMutation()
  const addItem = trpc.cart.addItem.useMutation()
  const [adding, setAdding] = useState(false)

  if (isLoading) return <p className="text-gray-400">Loading…</p>
  if (!product) return <p className="text-gray-400">Product not found.</p>

  const variant = product.variants[0]
  const cover = product.images[0]

  async function addToCart() {
    if (!variant) return
    setAdding(true)
    try {
      let cartId = getCartId()
      if (!cartId) {
        const cart = await createCart.mutateAsync({ currency: meta.currency })
        cartId = cart.id
        setCartId(cartId)
      }
      await addItem.mutateAsync({ cartId, variantId: variant.id, quantity: 1 })
      navigate('/cart')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
        {cover && (
          <img
            src={cover.url}
            alt={cover.alt ?? product.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
        {variant && (
          <p className="text-xl mb-4" style={{ color: 'var(--primary)' }}>
            {fmt(variant.priceAmount, variant.priceCurrency)}
          </p>
        )}
        {product.description && <p className="text-gray-600 mb-6">{product.description}</p>}
        <button
          type="button"
          onClick={addToCart}
          disabled={adding || !variant}
          className="px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {adding ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
    </div>
  )
}
