import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { addressSchema } from '../address-schema.js'
import { checkoutLimitedProcedure, publicProcedure, router } from '../trpc.js'

const orderIdInput = z.object({ orderId: z.string().uuid() })

export const checkoutRouter = router({
  /**
   * Returns the group price for a variant at the given quantity (the best B2B
   * tier the customer qualifies for), or null if they have no special pricing.
   */
  groupPrice: publicProcedure
    .input(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).default(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.customerId) return null
      return ctx.redbird.customerGroupsSvc.getGroupPrice(
        ctx.customerId,
        input.variantId,
        input.quantity,
      )
    }),

  /**
   * Returns the shipping rate for a cart + destination country.
   * Returns null when no shipping provider is configured.
   */
  previewShipping: publicProcedure
    .input(
      z.object({
        cartId: z.string().uuid(),
        countryCode: z.string().min(2).max(2),
      }),
    )
    .query(async ({ ctx, input }) => {
      const provider = ctx.redbird.shipping.default()
      if (!provider) return null
      const cart = await ctx.redbird.cart.get(input.cartId)
      if (!cart) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cart not found' })
      const subtotal = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)
      const currency = cart.lineItems[0]?.unitPriceCurrency ?? ctx.redbird.config.defaultCurrency
      return provider.calculate(input.countryCode.toUpperCase(), subtotal, 0, currency)
    }),

  /** Returns the tax preview for a given subtotal + country. Returns null when no tax provider is configured. */
  previewTax: publicProcedure
    .input(
      z.object({
        subtotalCents: z.number().int().min(0),
        countryCode: z.string().min(2).max(2),
        vatNumber: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const taxProvider = ctx.redbird.taxes.default()
      if (!taxProvider) return null
      const opts: { vatNumber?: string } = {}
      if (input.vatNumber) opts.vatNumber = input.vatNumber
      return taxProvider.calculate(input.subtotalCents, input.countryCode.toUpperCase(), opts)
    }),

  /** Validate a gift card code. Returns balance or invalid reason. */
  validateGiftCard: checkoutLimitedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        currency: z.string().length(3),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.redbird.giftCards.validate(input.code, input.currency)
    }),

  /** Validate a promo code against a subtotal. Returns discount info or invalid reason.
   * lineItems is needed to preview bogo/tiered codes — omit for plain percentage/fixed. */
  validatePromo: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
        subtotalCents: z.number().int().min(0),
        lineItems: z
          .array(
            z.object({
              unitPriceAmount: z.number().int().min(0),
              quantity: z.number().int().min(1),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.redbird.promos.validate(input.code, input.subtotalCents, input.lineItems)
    }),

  createOrder: checkoutLimitedProcedure
    .input(
      z.object({
        cartId: z.string().uuid(),
        customerEmail: z.string().email(),
        shippingAddress: addressSchema.optional(),
        vatNumber: z.string().optional(),
        promoCode: z.string().optional(),
        loyaltyPointsToRedeem: z.number().int().min(1).optional(),
        giftCardCode: z.string().optional(),
        notes: z.string().optional(),
        /** B2B purchase-order checkout — skips card payment. Requires the customer's
         * group to have net payment terms configured; rejected otherwise. */
        poNumber: z.string().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cart = await ctx.redbird.cart.get(input.cartId)
      if (!cart) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cart not found' })
      const subtotal = cart.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0)
      const currency = cart.lineItems[0]?.unitPriceCurrency ?? ctx.redbird.config.defaultCurrency
      const countryCode = input.shippingAddress?.countryCode.toUpperCase()

      // Shipping and tax are always recomputed server-side — the client only ever
      // supplies the destination address, never the resulting amounts.
      let shippingAmount = 0
      const shippingProvider = ctx.redbird.shipping.default()
      if (shippingProvider && countryCode) {
        const rate = shippingProvider.calculate(countryCode, subtotal, 0, currency)
        shippingAmount = rate.free ? 0 : rate.amount
      }

      // Loyalty validation (doesn't need cart)
      const loyaltyPoints = input.loyaltyPointsToRedeem ?? 0
      let loyaltyDiscountAmount = 0
      if (loyaltyPoints > 0) {
        if (!ctx.customerId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to use loyalty points',
          })
        }
        const cfg = ctx.redbird.loyaltyConfig
        if (!cfg.enabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Loyalty program is disabled' })
        }
        const redeemRate = cfg.redeemRate
        const loyaltyBalance = await ctx.redbird.loyalty.getBalance(ctx.customerId)
        if (loyaltyBalance < loyaltyPoints) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient loyalty points (balance: ${loyaltyBalance})`,
          })
        }
        loyaltyDiscountAmount = ctx.redbird.loyalty.previewRedeem(loyaltyPoints, redeemRate)
      }

      // Promo code
      let promoDiscountAmount = 0
      if (input.promoCode) {
        const lineItemsForPromo = cart.lineItems.map((li) => ({
          unitPriceAmount: li.unitPriceAmount,
          quantity: li.quantity,
        }))
        const validation = await ctx.redbird.promos.validate(
          input.promoCode,
          subtotal,
          lineItemsForPromo,
        )
        if (!validation.valid) {
          const msgs: Record<string, string> = {
            not_found: 'Promo code not found',
            inactive: 'Promo code is inactive',
            expired: 'Promo code has expired',
            max_uses_reached: 'Promo code has reached its usage limit',
            minimum_not_met: 'Cart total does not meet the minimum for this promo code',
            line_items_required: 'This promo code requires cart items to evaluate',
          }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: msgs[validation.reason] ?? 'Invalid promo code',
          })
        }
        promoDiscountAmount = validation.discountAmount
      }

      // Customer group price discount — compute the delta between cart prices and group prices
      let groupPriceDiscount = 0
      if (ctx.customerId) {
        for (const li of cart.lineItems) {
          const groupPrice = await ctx.redbird.customerGroupsSvc.getGroupPrice(
            ctx.customerId,
            li.variantId,
          )
          if (groupPrice && groupPrice.priceAmount < li.unitPriceAmount) {
            groupPriceDiscount += (li.unitPriceAmount - groupPrice.priceAmount) * li.quantity
          }
        }
      }

      // Gift card — capped against subtotal + shipping, net of discounts already applied.
      // Tax isn't in this cap: it's computed just below, on the post-discount subtotal,
      // and gift cards are a payment method rather than a further price reduction.
      let giftCardDiscount = 0
      if (input.giftCardCode) {
        const gcValidation = await ctx.redbird.giftCards.validate(input.giftCardCode, currency)
        if (!gcValidation.valid) {
          const msgs: Record<string, string> = {
            not_found: 'Gift card not found',
            expired: 'Gift card has expired',
            empty: 'Gift card has no remaining balance',
            currency_mismatch: 'Gift card currency does not match',
          }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: msgs[gcValidation.reason] ?? 'Invalid gift card',
          })
        }
        const alreadyDiscounted = loyaltyDiscountAmount + promoDiscountAmount + groupPriceDiscount
        const cap = Math.max(0, subtotal + shippingAmount - alreadyDiscounted)
        giftCardDiscount = Math.min(gcValidation.balance, cap)
      }

      const discountAmount =
        loyaltyDiscountAmount + promoDiscountAmount + giftCardDiscount + groupPriceDiscount

      // Tax is computed on the post-discount subtotal, never on the raw cart total.
      let taxAmount: number | undefined
      const taxProvider = ctx.redbird.taxes.default()
      if (taxProvider && countryCode) {
        let verifiedVatNumber: string | undefined
        if (
          input.vatNumber &&
          'validateVatNumber' in taxProvider &&
          typeof taxProvider.validateVatNumber === 'function'
        ) {
          try {
            const viesResult = await taxProvider.validateVatNumber(input.vatNumber)
            if (viesResult.valid) verifiedVatNumber = input.vatNumber
          } catch {
            // VIES unreachable — fall back to charging tax rather than granting an
            // unverified reverse charge.
          }
        }
        const taxableBase = Math.max(0, subtotal - discountAmount)
        const opts: { vatNumber?: string } = {}
        if (verifiedVatNumber) opts.vatNumber = verifiedVatNumber
        taxAmount = taxProvider.calculate(taxableBase, countryCode, opts).taxAmount
      }

      // Purchase-order checkout: only for logged-in customers whose group has net
      // terms configured. Everyone else must pay by card via initiatePayment.
      let poNumber: string | undefined
      let dueDate: Date | undefined
      if (input.poNumber) {
        if (!ctx.customerId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to pay by purchase order',
          })
        }
        const termsDays = await ctx.redbird.customerGroupsSvc.getPaymentTermsDays(ctx.customerId)
        if (termsDays === null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Your account is not eligible for purchase-order payment',
          })
        }
        poNumber = input.poNumber
        dueDate = new Date(Date.now() + termsDays * 24 * 60 * 60 * 1000)
      }

      const order = await ctx.redbird.orders.createFromCart(input.cartId, {
        customerEmail: input.customerEmail,
        shippingAddress: input.shippingAddress,
        shippingAmount,
        taxAmount,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        promoCode: input.promoCode,
        notes: input.notes,
        poNumber,
        dueDate,
      })

      if (input.promoCode && promoDiscountAmount > 0) {
        await ctx.redbird.promos.redeem(input.promoCode)
      }

      if (loyaltyPoints > 0 && ctx.customerId) {
        await ctx.redbird.loyalty.redeem(
          ctx.customerId,
          loyaltyPoints,
          `Redeemed on order ${order.number}`,
          order.id,
        )
      }

      if (input.giftCardCode && giftCardDiscount > 0) {
        await ctx.redbird.giftCards.redeem(input.giftCardCode, giftCardDiscount, order.id)
      }

      return order
    }),

  /**
   * Initiate payment for a pending order.
   * Returns a PaymentIntent — for Stripe the clientSecret is used to mount
   * Stripe Elements; for PayPal the id is the PayPal order ID for the redirect.
   */
  initiatePayment: publicProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        /** Payment provider name — defaults to the configured default provider. */
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.redbird.orders.get(input.orderId)
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      if (order.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot initiate payment: order is already ${order.status}`,
        })
      }

      const provider = input.provider
        ? ctx.redbird.payments.get(input.provider)
        : ctx.redbird.payments.default()

      if (!provider) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'No payment provider configured. Register a plugin (e.g. @redbird/plugin-stripe).',
        })
      }

      const intent = await provider.createPaymentIntent({
        amount: order.totalAmount,
        currency: order.currency,
        metadata: { orderId: order.id, orderNumber: order.number },
      })
      // Recorded so a later refund can call back into the same gateway/payment.
      await ctx.redbird.orders.setPaymentReference(order.id, provider.name, intent.id)
      return intent
    }),

  get: publicProcedure.input(orderIdInput).query(async ({ ctx, input }) => {
    const order = await ctx.redbird.orders.get(input.orderId)
    if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
    return order
  }),

  getByNumber: publicProcedure
    .input(z.object({ number: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.redbird.orders.getByNumber(input.number)
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      return order
    }),

  /** Guest order tracking — look up orders by email (no auth required). */
  listByEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.redbird.orders.listByEmail(input.email, { limit: input.limit })
    }),

  // Order listing and status mutations (list/markPaid/markFulfilled/cancel/refund) live
  // in packages/api/src/routers/admin.ts under `orders.*`, gated by adminProcedure.
  // A customer's own order history is served by customers.orders (protectedProcedure).
})
