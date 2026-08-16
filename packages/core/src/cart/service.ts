import { and, eq, isNull } from 'drizzle-orm'
import type { CurrencyService } from '../currency/service.js'
import type { CustomerGroupService } from '../customer-groups/service.js'
import type { DbClient } from '../db/client.js'
import {
  type Address,
  type Cart,
  type CartLineItem,
  cartLineItems,
  carts,
  productVariants,
} from '../db/schema.js'
import type { PluginRegistry } from '../plugins/registry.js'
import type { StockService } from '../stock/service.js'

export type CartLineItemWithProduct = CartLineItem & {
  productName: string
  variantName: string
  sku: string
  image: string | null
}

export type CartWithItems = Cart & { lineItems: CartLineItemWithProduct[] }

export type CartService = {
  create(opts: {
    currency: string
    customerId?: string | undefined
    customerEmail?: string | undefined
    tenantId?: string | null | undefined
  }): Promise<Cart>
  get(id: string): Promise<CartWithItems | null>
  /** Associate a guest email with the cart so createFromCart can pick it up automatically. */
  setEmail(cartId: string, email: string): Promise<Cart>
  /**
   * Attach a cart started as a guest to a now-authenticated customer, so the resulting
   * order links to their account (order history, loyalty points). Only claims carts that
   * aren't already owned — logging in never reassigns someone else's cart.
   */
  claim(cartId: string, customerId: string, customerEmail: string): Promise<Cart>
  setShippingAddress(cartId: string, address: Address): Promise<Cart>
  addItem(cartId: string, variantId: string, quantity: number): Promise<CartLineItem>
  removeItem(cartId: string, lineItemId: string): Promise<void>
  updateItemQuantity(cartId: string, lineItemId: string, quantity: number): Promise<CartLineItem>
  clear(cartId: string): Promise<void>
  subtotal(cartId: string): Promise<{ amount: number; currency: string }>
}

export function createCartService(
  db: DbClient,
  hooks: PluginRegistry,
  stock?: StockService,
  currency?: CurrencyService,
  groups?: CustomerGroupService,
): CartService {
  /**
   * Resolves the unit price for a variant at a given line-item quantity: a
   * matching B2B group-quantity tier (if the cart belongs to a customer in a
   * group with a rule for this variant) takes priority over the variant's own
   * price, converted into the cart's currency either way.
   */
  async function resolveUnitPrice(
    cart: Pick<Cart, 'customerId' | 'currency'>,
    variant: typeof productVariants.$inferSelect,
    quantity: number,
  ): Promise<number> {
    const groupPrice =
      cart.customerId && groups
        ? await groups.getGroupPrice(cart.customerId, variant.id, quantity)
        : null

    const amount = groupPrice?.priceAmount ?? variant.priceAmount
    const sourceCurrency = groupPrice?.priceCurrency ?? variant.priceCurrency
    if (sourceCurrency === cart.currency) return amount
    if (!currency) {
      throw new Error(
        `Variant currency ${sourceCurrency} does not match cart currency ${cart.currency}`,
      )
    }
    return currency.convert(amount, sourceCurrency, cart.currency)
  }

  async function loadCart(id: string): Promise<CartWithItems | null> {
    const row = await db.query.carts.findFirst({
      where: eq(carts.id, id),
      with: {
        lineItems: {
          with: {
            variant: {
              with: { product: { with: { images: true } } },
            },
          },
        },
      },
    })
    if (!row) return null
    return {
      ...row,
      lineItems: row.lineItems.map(({ variant, ...li }) => {
        const image = [...(variant?.product?.images ?? [])].sort(
          (a, b) => a.position - b.position,
        )[0]
        return {
          ...li,
          productName: variant?.product?.name ?? 'Unknown product',
          variantName: variant?.name ?? '',
          sku: variant?.sku ?? '',
          image: image?.url ?? null,
        }
      }),
    }
  }

  async function loadCartOrThrow(id: string): Promise<CartWithItems> {
    const cart = await loadCart(id)
    if (!cart) throw new Error(`Cart ${id} not found`)
    return cart
  }

  return {
    async create({ currency, customerId, customerEmail, tenantId }) {
      const [cart] = await db
        .insert(carts)
        .values({
          currency,
          customerId: customerId ?? null,
          customerEmail: customerEmail ?? null,
          tenantId: tenantId ?? null,
        })
        .returning()
      if (!cart) throw new Error('Failed to create cart')
      await hooks.emit('cart.created', { cart })
      return cart
    },

    get: loadCart,

    async setEmail(cartId, email) {
      const [cart] = await db
        .update(carts)
        .set({ customerEmail: email, updatedAt: new Date() })
        .where(eq(carts.id, cartId))
        .returning()
      if (!cart) throw new Error(`Cart ${cartId} not found`)
      return cart
    },

    async claim(cartId, customerId, customerEmail) {
      const [cart] = await db
        .update(carts)
        .set({ customerId, customerEmail, updatedAt: new Date() })
        .where(and(eq(carts.id, cartId), isNull(carts.customerId)))
        .returning()
      // Not an error if it's already claimed (e.g. by this same customer on another tab) —
      // just return the current row.
      return cart ?? (await loadCartOrThrow(cartId))
    },

    async setShippingAddress(cartId, address) {
      const [cart] = await db
        .update(carts)
        .set({ shippingAddress: address, updatedAt: new Date() })
        .where(eq(carts.id, cartId))
        .returning()
      if (!cart) throw new Error(`Cart ${cartId} not found`)
      return cart
    },

    async addItem(cartId, variantId, quantity) {
      if (quantity < 1) throw new Error('Quantity must be >= 1')

      const cart = await loadCartOrThrow(cartId)

      await hooks.emit('cart.beforeAddItem', { cart, variantId, quantity })

      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
      })
      if (!variant) throw new Error(`Variant ${variantId} not found`)

      await stock?.reserve(variantId, quantity)

      const existing = cart.lineItems.find((li) => li.variantId === variantId)
      // Reprice off the final quantity (existing + added) so crossing a B2B
      // quantity tier applies retroactively to the whole line, not just the
      // newly-added units.
      const finalQuantity = existing ? existing.quantity + quantity : quantity
      const unitPriceAmount = await resolveUnitPrice(cart, variant, finalQuantity)

      let lineItem: CartLineItem

      if (existing) {
        const [updated] = await db
          .update(cartLineItems)
          .set({ quantity: finalQuantity, unitPriceAmount, updatedAt: new Date() })
          .where(eq(cartLineItems.id, existing.id))
          .returning()
        if (!updated) throw new Error('Failed to update line item')
        lineItem = updated
      } else {
        const [created] = await db
          .insert(cartLineItems)
          .values({
            cartId,
            variantId,
            quantity,
            unitPriceAmount,
            unitPriceCurrency: cart.currency,
          })
          .returning()
        if (!created) throw new Error('Failed to create line item')
        lineItem = created
      }

      await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId))
      const refreshed = await loadCartOrThrow(cartId)
      await hooks.emit('cart.afterAddItem', { cart: refreshed, lineItem })
      return lineItem
    },

    async removeItem(cartId, lineItemId) {
      const cart = await loadCartOrThrow(cartId)
      const li = cart.lineItems.find((l) => l.id === lineItemId)
      await hooks.emit('cart.beforeRemoveItem', { cart, lineItemId })
      await db
        .delete(cartLineItems)
        .where(and(eq(cartLineItems.id, lineItemId), eq(cartLineItems.cartId, cartId)))
      if (li) await stock?.release(li.variantId, li.quantity)
      const refreshed = await loadCartOrThrow(cartId)
      await hooks.emit('cart.afterRemoveItem', { cart: refreshed })
    },

    async updateItemQuantity(cartId, lineItemId, quantity) {
      if (quantity < 1) throw new Error('Quantity must be >= 1 (use removeItem to delete)')
      const cart = await loadCartOrThrow(cartId)
      const existing = cart.lineItems.find((li) => li.id === lineItemId)
      if (!existing) throw new Error(`Line item ${lineItemId} not found in cart ${cartId}`)
      const delta = quantity - existing.quantity
      if (delta > 0) await stock?.reserve(existing.variantId, delta)
      if (delta < 0) await stock?.release(existing.variantId, -delta)

      // Reprice on every quantity change so crossing a B2B tier threshold
      // (up or down) is always reflected.
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, existing.variantId),
      })
      const unitPriceAmount = variant
        ? await resolveUnitPrice(cart, variant, quantity)
        : existing.unitPriceAmount

      const [updated] = await db
        .update(cartLineItems)
        .set({ quantity, unitPriceAmount, updatedAt: new Date() })
        .where(eq(cartLineItems.id, lineItemId))
        .returning()
      if (!updated) throw new Error(`Failed to update line item ${lineItemId}`)
      return updated
    },

    async clear(cartId) {
      const cart = await loadCartOrThrow(cartId)
      await db.delete(cartLineItems).where(eq(cartLineItems.cartId, cartId))
      if (stock) {
        for (const li of cart.lineItems) {
          await stock.release(li.variantId, li.quantity)
        }
      }
      const refreshed = await loadCartOrThrow(cartId)
      await hooks.emit('cart.cleared', { cart: refreshed })
    },

    async subtotal(cartId) {
      const cart = await loadCartOrThrow(cartId)
      const amount = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)
      return { amount, currency: cart.currency }
    },
  }
}
