import type {
  Cart,
  CartLineItem,
  Category,
  Order,
  OrderLineItem,
  Product,
  ProductVariant,
} from '../db/schema.js'

/**
 * Hook event map.
 *
 * The KEY is the hook name (namespaced "domain.event").
 * The VALUE is the context payload handlers receive.
 *
 * Plugins subscribe to hooks via the `hooks` field of their definition.
 * Core code emits hooks via `redbird.hooks.emit(name, ctx)`.
 *
 * Adding a new hook here automatically gives plugin authors typed access to it.
 */
export type HookMap = {
  // Catalog
  'product.created': { product: Product }
  'product.updated': { product: Product }
  'product.deleted': { productId: string }
  'product.viewed': { product: Product }
  'variant.created': { variant: ProductVariant }
  'variant.updated': { variant: ProductVariant }

  // Categories
  'category.created': { category: Category }
  'category.updated': { category: Category }
  'category.deleted': { categoryId: string }

  // Cart
  'cart.created': { cart: Cart }
  'cart.beforeAddItem': { cart: Cart; variantId: string; quantity: number }
  'cart.afterAddItem': { cart: Cart; lineItem: CartLineItem }
  'cart.beforeRemoveItem': { cart: Cart; lineItemId: string }
  'cart.afterRemoveItem': { cart: Cart }
  'cart.cleared': { cart: Cart }

  // Order
  'order.created': { order: Order; lineItems: ReadonlyArray<OrderLineItem> }
  'order.paid': { order: Order }
  'order.fulfilled': { order: Order }
  'order.cancelled': { order: Order }
  'order.refunded': { order: Order }

  // Stock
  'stock.low': { variantId: string; available: number; productId: string; productName: string; variantName: string }
}

export type HookName = keyof HookMap

export type HookHandler<K extends HookName> = (ctx: HookMap[K]) => Promise<void> | void

export type HookHandlers = Partial<{ [K in HookName]: HookHandler<K> }>
