import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

// ---------- Customers ----------

export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    firstName: text(),
    lastName: text(),
    passwordHash: text().notNull(),
    resetToken: text(),
    resetTokenExpiresAt: timestamp({ withTimezone: true }),
    /** Opt-in only — required before any marketing campaign email can be sent to them. */
    marketingOptIn: boolean().notNull().default(false),
    /** One-click unsubscribe link token. Generated lazily on first campaign send. */
    unsubscribeToken: text(),
    /** Null = the original single-tenant store. Set for accounts created under a specific tenant. */
    tenantId: uuid().references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customers_email_idx').on(t.email),
    uniqueIndex('customers_unsubscribe_token_idx').on(t.unsubscribeToken),
    index('customers_tenant_id_idx').on(t.tenantId),
  ],
)

// ---------- Saved payment methods ----------
//
// Card display fields (brand/last4/exp) are always fetched fresh from the
// gateway when a method is attached — never trust client-supplied values —
// and cached here purely for display, never used to authorize a charge.

export const customerPaymentMethods = pgTable(
  'customer_payment_methods',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Payment provider plugin name, e.g. '@redbird/plugin-stripe'. */
    provider: text().notNull(),
    /** Gateway-side customer id (e.g. Stripe Customer id) — required to charge off-session. */
    providerCustomerId: text().notNull(),
    /** Gateway-side payment method id (e.g. Stripe PaymentMethod id). */
    providerPaymentMethodId: text().notNull(),
    brand: text(),
    last4: text(),
    expMonth: integer(),
    expYear: integer(),
    isDefault: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_payment_methods_customer_id_idx').on(t.customerId),
    uniqueIndex('customer_payment_methods_provider_pm_idx').on(
      t.provider,
      t.providerPaymentMethodId,
    ),
  ],
)

export type CustomerPaymentMethod = typeof customerPaymentMethods.$inferSelect
export type NewCustomerPaymentMethod = typeof customerPaymentMethods.$inferInsert

export const customerPaymentMethodsRelations = relations(customerPaymentMethods, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPaymentMethods.customerId],
    references: [customers.id],
  }),
}))

// ---------- Products ----------

export const productStatus = pgEnum('product_status', ['draft', 'active', 'archived'])

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    status: productStatus().notNull().default('draft'),
    metaTitle: text(),
    metaDescription: text(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    brandId: uuid(),
    isVirtual: boolean().notNull().default(false),
    /** VAT rate in basis points (2000 = 20%, 550 = 5.5%). Null = store default. */
    taxRateBp: integer(),
    /** Marketplace vendor who owns this listing — null means it's the store's own product. */
    sellerId: uuid().references((): AnyPgColumn => sellers.id, { onDelete: 'set null' }),
    /** Null = the original single-tenant store's catalog. Set for a specific tenant's storefront. */
    tenantId: uuid().references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_status_idx').on(t.status),
    index('products_brand_id_idx').on(t.brandId),
    index('products_seller_id_idx').on(t.sellerId),
    index('products_tenant_id_idx').on(t.tenantId),
  ],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text().notNull(),
    name: text().notNull(),
    priceAmount: integer().notNull(),
    priceCurrency: text().notNull(),
    inventoryQuantity: integer().notNull().default(0),
    attributes: jsonb().$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_variants_sku_idx').on(t.sku),
    index('product_variants_product_id_idx').on(t.productId),
  ],
)

// ---------- Categories ----------

export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    imageUrl: text(),
    parentId: uuid().references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
    /** Null = the original single-tenant store's catalog. Set for a specific tenant's storefront. */
    tenantId: uuid().references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_slug_idx').on(t.slug),
    index('categories_parent_id_idx').on(t.parentId),
    index('categories_tenant_id_idx').on(t.tenantId),
  ],
)

export const productCategories = pgTable(
  'product_categories',
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index('product_categories_category_id_idx').on(t.categoryId),
  ],
)

export const productFeatures = pgTable(
  'product_features',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    value: text().notNull(),
    position: integer().notNull().default(0),
  },
  (t) => [index('product_features_product_id_idx').on(t.productId)],
)

// ---------- Promos ----------

export const discountType = pgEnum('discount_type', ['percentage', 'fixed', 'bogo', 'tiered'])

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    type: discountType().notNull(),
    /** Percentage: 0–100. Fixed: amount in smallest currency unit. Ignored for bogo/tiered. */
    value: integer().notNull(),
    currency: text(),
    /** Minimum cart subtotal in smallest currency unit to apply the code. */
    minimumAmount: integer(),
    /** Maximum number of total uses. Null = unlimited. */
    maxUses: integer(),
    /** Total number of times this code has been used. */
    usedCount: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }),
    active: boolean().notNull().default(true),
    /** type = 'bogo' only: e.g. buy 2 get 1 at 50% off. */
    bogoConfig: jsonb().$type<{
      buyQuantity: number
      getQuantity: number
      /** Percentage off each "get" unit — 100 = free. */
      getDiscountPercent: number
    }>(),
    /** type = 'tiered' only: cart-quantity breakpoints, e.g. 3+ units → 10% off,
     * 5+ units → 15% off. The highest tier whose minQuantity is met applies. */
    tiers: jsonb().$type<Array<{ minQuantity: number; discountPercent: number }>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promo_codes_code_idx').on(t.code)],
)

// ---------- Product Translations ----------

export const productTranslations = pgTable(
  'product_translations',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** BCP 47 locale tag, e.g. "fr", "fr-FR", "en-US" */
    locale: text().notNull(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_translations_product_locale_idx').on(t.productId, t.locale),
    index('product_translations_locale_idx').on(t.locale),
  ],
)

// ---------- Product Images ----------

export const productImages = pgTable(
  'product_images',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),
    url: text().notNull(),
    alt: text(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('product_images_product_id_idx').on(t.productId),
    index('product_images_variant_id_idx').on(t.variantId),
  ],
)

// ---------- Stock ----------

/**
 * `stockLevels` stays the single reservation pool used by cart/order flows
 * (available/reserved/committed) — that logic is unchanged and still
 * variant-scoped only. Warehouses add a WHERE dimension on top: `available`
 * is kept equal to (sum of warehouseStock quantities) − reserved − committed,
 * so the existing atomic reserve/release/commit code never has to know
 * warehouses exist.
 */
export const stockLevels = pgTable(
  'stock_levels',
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    available: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    committed: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('stock_levels_variant_id_idx').on(t.variantId)],
)

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    code: text().notNull(),
    address: jsonb().$type<Address>(),
    active: boolean().notNull().default(true),
    /** The warehouse new stock defaults to when a merchant hasn't picked one yet. */
    isDefault: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('warehouses_code_idx').on(t.code)],
)

/** Physical quantity of a variant sitting in a given warehouse. */
export const warehouseStock = pgTable(
  'warehouse_stock',
  {
    id: uuid().primaryKey().defaultRandom(),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('warehouse_stock_warehouse_variant_idx').on(t.warehouseId, t.variantId),
    index('warehouse_stock_variant_id_idx').on(t.variantId),
  ],
)

export const warehouseStockRelations = relations(warehouseStock, ({ one }) => ({
  warehouse: one(warehouses, { fields: [warehouseStock.warehouseId], references: [warehouses.id] }),
  variant: one(productVariants, {
    fields: [warehouseStock.variantId],
    references: [productVariants.id],
  }),
}))

export type Warehouse = typeof warehouses.$inferSelect
export type NewWarehouse = typeof warehouses.$inferInsert
export type WarehouseStock = typeof warehouseStock.$inferSelect

// ---------- Address ----------

export type Address = {
  firstName: string
  lastName: string
  line1: string
  line2?: string | undefined
  city: string
  postalCode: string
  /** ISO 3166-1 alpha-2, e.g. "FR" */
  countryCode: string
  phone?: string | undefined
}

// ---------- Carts ----------

export const cartStatus = pgEnum('cart_status', ['active', 'checked_out', 'abandoned'])

export const carts = pgTable(
  'carts',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid(),
    customerEmail: text(),
    currency: text().notNull(),
    status: cartStatus().notNull().default('active'),
    shippingAddress: jsonb().$type<Address>(),
    /** Null = the original single-tenant store. Set when the cart was opened under a specific tenant. */
    tenantId: uuid().references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('carts_customer_id_idx').on(t.customerId),
    index('carts_status_idx').on(t.status),
    index('carts_tenant_id_idx').on(t.tenantId),
  ],
)

export const cartLineItems = pgTable(
  'cart_line_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: integer().notNull(),
    unitPriceAmount: integer().notNull(),
    unitPriceCurrency: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cart_line_items_cart_id_idx').on(t.cartId)],
)

// ---------- Orders ----------

export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
])

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull(),
    customerId: uuid(),
    customerEmail: text().notNull(),
    status: orderStatus().notNull().default('pending'),
    currency: text().notNull(),
    subtotalAmount: integer().notNull(),
    shippingAmount: integer().notNull().default(0),
    taxAmount: integer().notNull().default(0),
    discountAmount: integer().notNull().default(0),
    promoCode: text(),
    totalAmount: integer().notNull(),
    notes: text(),
    trackingNumber: text(),
    trackingUrl: text(),
    shippingAddress: jsonb().$type<Address>(),
    refundedAmount: integer().notNull().default(0),
    /** Name of the payment provider plugin used to pay this order (e.g. '@redbird/plugin-stripe'). */
    paymentProvider: text(),
    /** Provider-specific payment reference (PaymentIntent id, PayPal order id...) — used to issue real refunds. */
    paymentReference: text(),
    /** Sequential, gapless legal invoice number — assigned when the invoice is issued. */
    invoiceNumber: text(),
    invoicedAt: timestamp({ withTimezone: true }),
    /** Set only for in-person sales rung up through the POS — null for online orders. */
    registerSessionId: uuid().references((): AnyPgColumn => registerSessions.id, {
      onDelete: 'set null',
    }),
    /** Null = the original single-tenant store. Set for an order placed under a specific tenant. */
    tenantId: uuid().references((): AnyPgColumn => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.number),
    uniqueIndex('orders_invoice_number_idx').on(t.invoiceNumber),
    index('orders_customer_id_idx').on(t.customerId),
    index('orders_status_idx').on(t.status),
    index('orders_created_at_idx').on(t.createdAt),
    index('orders_register_session_id_idx').on(t.registerSessionId),
    index('orders_tenant_id_idx').on(t.tenantId),
  ],
)

/** Atomic, gapless sequence counters (e.g. legal invoice numbering per year). */
export const counters = pgTable('counters', {
  key: text().primaryKey(),
  value: integer().notNull().default(0),
})

// ---------- Point of sale — register sessions ----------
//
// A cashier opens a session with a starting cash float, rings up sales
// against it (linked via orders.registerSessionId), and closes it by
// counting the drawer — the difference from the expected amount (opening +
// cash sales - cash refunds, computed at read time from linked orders)
// surfaces as an over/short.

export const registerSessionStatus = pgEnum('register_session_status', ['open', 'closed'])

export const registerSessions = pgTable(
  'register_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: 'restrict' }),
    status: registerSessionStatus().notNull().default('open'),
    openingCashAmount: integer().notNull(),
    closingCashAmount: integer(),
    notes: text(),
    openedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('register_sessions_staff_id_idx').on(t.staffId),
    index('register_sessions_status_idx').on(t.status),
  ],
)

export type RegisterSession = typeof registerSessions.$inferSelect
export type NewRegisterSession = typeof registerSessions.$inferInsert

export const registerSessionsRelations = relations(registerSessions, ({ one, many }) => ({
  staff: one(staff, { fields: [registerSessions.staffId], references: [staff.id] }),
  orders: many(orders),
}))

export const orderLineItems = pgTable(
  'order_line_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text().notNull(),
    variantName: text().notNull(),
    sku: text().notNull(),
    quantity: integer().notNull(),
    unitPriceAmount: integer().notNull(),
    unitPriceCurrency: text().notNull(),
    totalAmount: integer().notNull(),
    /** VAT rate captured at order time, in basis points (2000 = 20%). */
    taxRateBp: integer(),
    /** Snapshot of the product's seller at sale time — null for the store's own products. */
    sellerId: uuid().references((): AnyPgColumn => sellers.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_line_items_order_id_idx').on(t.orderId),
    index('order_line_items_seller_id_idx').on(t.sellerId),
  ],
)

// ---------- Customer groups ----------

export const customerGroups = pgTable(
  'customer_groups',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customer_groups_name_idx').on(t.name)],
)

export const customerGroupMembers = pgTable(
  'customer_group_members',
  {
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    groupId: uuid()
      .notNull()
      .references(() => customerGroups.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.customerId, t.groupId] }),
    index('customer_group_members_group_id_idx').on(t.groupId),
  ],
)

export const groupPriceRules = pgTable(
  'group_price_rules',
  {
    id: uuid().primaryKey().defaultRandom(),
    groupId: uuid()
      .notNull()
      .references(() => customerGroups.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    priceAmount: integer().notNull(),
    priceCurrency: text().notNull(),
    /** Quantity break: this price applies once the line item reaches this quantity. */
    minQuantity: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('group_price_rules_group_variant_qty_idx').on(
      t.groupId,
      t.variantId,
      t.minQuantity,
    ),
    index('group_price_rules_group_id_idx').on(t.groupId),
    index('group_price_rules_variant_id_idx').on(t.variantId),
  ],
)

// ---------- B2B quote requests ----------
//
// Distinct from group price rules above: those are pre-set prices a staff
// member configures ahead of time for a whole customer group. A quote is
// customer-initiated and per-request — they ask about a specific cart of
// items, staff negotiates a one-off price per line, and accepting turns it
// into a cart at exactly those prices (bypassing normal live pricing).

export const quoteStatus = pgEnum('quote_status', [
  'pending',
  'quoted',
  'accepted',
  'rejected',
  'expired',
])

export const quoteRequests = pgTable(
  'quote_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    status: quoteStatus().notNull().default('pending'),
    currency: text().notNull(),
    customerNote: text(),
    staffNote: text(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('quote_requests_customer_id_idx').on(t.customerId),
    index('quote_requests_status_idx').on(t.status),
  ],
)

export const quoteRequestItems = pgTable(
  'quote_request_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    quoteRequestId: uuid()
      .notNull()
      .references(() => quoteRequests.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    /** Staff's negotiated unit price — set when the request moves to "quoted". */
    quotedPriceAmount: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('quote_request_items_quote_id_idx').on(t.quoteRequestId)],
)

export type QuoteRequest = typeof quoteRequests.$inferSelect
export type NewQuoteRequest = typeof quoteRequests.$inferInsert
export type QuoteRequestItem = typeof quoteRequestItems.$inferSelect
export type NewQuoteRequestItem = typeof quoteRequestItems.$inferInsert

export const quoteRequestsRelations = relations(quoteRequests, ({ one, many }) => ({
  customer: one(customers, { fields: [quoteRequests.customerId], references: [customers.id] }),
  items: many(quoteRequestItems),
}))

export const quoteRequestItemsRelations = relations(quoteRequestItems, ({ one }) => ({
  quoteRequest: one(quoteRequests, {
    fields: [quoteRequestItems.quoteRequestId],
    references: [quoteRequests.id],
  }),
  variant: one(productVariants, {
    fields: [quoteRequestItems.variantId],
    references: [productVariants.id],
  }),
}))

// ---------- Relations ----------

export const customersRelations = relations(customers, ({ many }) => ({
  carts: many(carts),
  orders: many(orders),
  groupMemberships: many(customerGroupMembers),
  wishlists: many(wishlists),
  paymentMethods: many(customerPaymentMethods),
  quoteRequests: many(quoteRequests),
}))

export const customerGroupsRelations = relations(customerGroups, ({ many }) => ({
  members: many(customerGroupMembers),
  priceRules: many(groupPriceRules),
}))

export const customerGroupMembersRelations = relations(customerGroupMembers, ({ one }) => ({
  customer: one(customers, {
    fields: [customerGroupMembers.customerId],
    references: [customers.id],
  }),
  group: one(customerGroups, {
    fields: [customerGroupMembers.groupId],
    references: [customerGroups.id],
  }),
}))

export const groupPriceRulesRelations = relations(groupPriceRules, ({ one }) => ({
  group: one(customerGroups, {
    fields: [groupPriceRules.groupId],
    references: [customerGroups.id],
  }),
  variant: one(productVariants, {
    fields: [groupPriceRules.variantId],
    references: [productVariants.id],
  }),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
  variants: many(productVariants),
  productCategories: many(productCategories),
  images: many(productImages),
  translations: many(productTranslations),
  attributes: many(productAttributes),
  features: many(productFeatures),
  relationsFrom: many(productRelations, { relationName: 'productRelationsSource' }),
}))

export const productFeaturesRelations = relations(productFeatures, ({ one }) => ({
  product: one(products, { fields: [productFeatures.productId], references: [products.id] }),
}))

export const productTranslationsRelations = relations(productTranslations, ({ one }) => ({
  product: one(products, { fields: [productTranslations.productId], references: [products.id] }),
}))

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id],
  }),
}))

// categoriesRelations is defined at the end of this file (after categoryTranslations),
// so TypeScript's block-scoped const TDZ check doesn't flag a forward reference.

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}))

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  stockLevel: one(stockLevels, {
    fields: [productVariants.id],
    references: [stockLevels.variantId],
  }),
  attributeValues: many(variantAttributeValues),
}))

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  variant: one(productVariants, {
    fields: [stockLevels.variantId],
    references: [productVariants.id],
  }),
}))

export const cartsRelations = relations(carts, ({ many }) => ({
  lineItems: many(cartLineItems),
}))

export const cartLineItemsRelations = relations(cartLineItems, ({ one }) => ({
  cart: one(carts, { fields: [cartLineItems.cartId], references: [carts.id] }),
  variant: one(productVariants, {
    fields: [cartLineItems.variantId],
    references: [productVariants.id],
  }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  lineItems: many(orderLineItems),
  registerSession: one(registerSessions, {
    fields: [orders.registerSessionId],
    references: [registerSessions.id],
  }),
}))

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
  seller: one(sellers, { fields: [orderLineItems.sellerId], references: [sellers.id] }),
}))

// ---------- Types ----------

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type PublicCustomer = Omit<
  Customer,
  'passwordHash' | 'resetToken' | 'resetTokenExpiresAt' | 'unsubscribeToken'
>

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type ProductFeature = typeof productFeatures.$inferSelect
export type NewProductFeature = typeof productFeatures.$inferInsert
export type ProductVariant = typeof productVariants.$inferSelect
export type NewProductVariant = typeof productVariants.$inferInsert
export type Cart = typeof carts.$inferSelect
export type NewCart = typeof carts.$inferInsert
export type CartLineItem = typeof cartLineItems.$inferSelect
export type NewCartLineItem = typeof cartLineItems.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderLineItem = typeof orderLineItems.$inferSelect
export type NewOrderLineItem = typeof orderLineItems.$inferInsert

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type StockLevel = typeof stockLevels.$inferSelect

export type ProductImage = typeof productImages.$inferSelect
export type NewProductImage = typeof productImages.$inferInsert

export type PromoCode = typeof promoCodes.$inferSelect
export type NewPromoCode = typeof promoCodes.$inferInsert

// ---------- Product Reviews ----------

export const productReviews = pgTable(
  'product_reviews',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    /** Display name — falls back to "Anonymous" if null */
    customerName: text().notNull(),
    rating: integer().notNull(),
    comment: text(),
    approved: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('product_reviews_product_id_idx').on(t.productId),
    index('product_reviews_approved_idx').on(t.approved),
  ],
)

// ---------- Return Requests ----------

export const returnStatus = pgEnum('return_status', ['pending', 'approved', 'rejected'])

export const returnRequests = pgTable(
  'return_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    status: returnStatus().notNull().default('pending'),
    adminNote: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('return_requests_order_id_idx').on(t.orderId)],
)

export const returnRequestItems = pgTable(
  'return_request_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    returnRequestId: uuid()
      .notNull()
      .references(() => returnRequests.id, { onDelete: 'cascade' }),
    lineItemId: uuid()
      .notNull()
      .references(() => orderLineItems.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    /** Whether approving this item should add its quantity back to available stock. */
    restock: boolean().notNull().default(true),
  },
  (t) => [index('return_request_items_return_id_idx').on(t.returnRequestId)],
)

export type ReturnRequestItem = typeof returnRequestItems.$inferSelect

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(products, { fields: [productReviews.productId], references: [products.id] }),
  customer: one(customers, { fields: [productReviews.customerId], references: [customers.id] }),
}))

export const returnRequestsRelations = relations(returnRequests, ({ one, many }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
  items: many(returnRequestItems),
}))

export const returnRequestItemsRelations = relations(returnRequestItems, ({ one }) => ({
  returnRequest: one(returnRequests, {
    fields: [returnRequestItems.returnRequestId],
    references: [returnRequests.id],
  }),
  lineItem: one(orderLineItems, {
    fields: [returnRequestItems.lineItemId],
    references: [orderLineItems.id],
  }),
}))

// ---------- Staff ----------

export const staffRole = pgEnum('staff_role', ['owner', 'admin', 'warehouse', 'support'])

export const staff = pgTable(
  'staff',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    firstName: text(),
    lastName: text(),
    role: staffRole().notNull().default('support'),
    active: boolean().notNull().default(true),
    /**
     * Bumped whenever role/active changes — embedded in staff JWTs at sign
     * time and checked on every staff-authenticated request, so a
     * demotion, deactivation, or forced logout takes effect immediately
     * instead of waiting out the token's 30-day expiry.
     */
    tokenVersion: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('staff_email_idx').on(t.email), index('staff_role_idx').on(t.role)],
)

// ---------- Product Attribute Combinations ----------

export const productAttributes = pgTable(
  'product_attributes',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    position: integer().notNull().default(0),
  },
  (t) => [index('product_attributes_product_id_idx').on(t.productId)],
)

export const attributeValues = pgTable(
  'attribute_values',
  {
    id: uuid().primaryKey().defaultRandom(),
    attributeId: uuid()
      .notNull()
      .references(() => productAttributes.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    position: integer().notNull().default(0),
  },
  (t) => [index('attribute_values_attribute_id_idx').on(t.attributeId)],
)

export const variantAttributeValues = pgTable(
  'variant_attribute_values',
  {
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    attributeValueId: uuid()
      .notNull()
      .references(() => attributeValues.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.attributeValueId] })],
)

export const productAttributesRelations = relations(productAttributes, ({ one, many }) => ({
  product: one(products, { fields: [productAttributes.productId], references: [products.id] }),
  values: many(attributeValues),
}))

export const attributeValuesRelations = relations(attributeValues, ({ one, many }) => ({
  attribute: one(productAttributes, {
    fields: [attributeValues.attributeId],
    references: [productAttributes.id],
  }),
  variantValues: many(variantAttributeValues),
}))

export const variantAttributeValuesRelations = relations(variantAttributeValues, ({ one }) => ({
  variant: one(productVariants, {
    fields: [variantAttributeValues.variantId],
    references: [productVariants.id],
  }),
  attributeValue: one(attributeValues, {
    fields: [variantAttributeValues.attributeValueId],
    references: [attributeValues.id],
  }),
}))

export type ProductTranslation = typeof productTranslations.$inferSelect
export type NewProductTranslation = typeof productTranslations.$inferInsert
export type ProductReview = typeof productReviews.$inferSelect
export type NewProductReview = typeof productReviews.$inferInsert
export type ReturnRequest = typeof returnRequests.$inferSelect
export type NewReturnRequest = typeof returnRequests.$inferInsert
export type StaffMember = typeof staff.$inferSelect
export type NewStaffMember = typeof staff.$inferInsert
export type StaffRole = (typeof staffRole.enumValues)[number]
export type CustomerGroup = typeof customerGroups.$inferSelect
export type NewCustomerGroup = typeof customerGroups.$inferInsert
export type CustomerGroupMember = typeof customerGroupMembers.$inferSelect
export type GroupPriceRule = typeof groupPriceRules.$inferSelect
export type NewGroupPriceRule = typeof groupPriceRules.$inferInsert
export type ProductAttribute = typeof productAttributes.$inferSelect
export type AttributeValue = typeof attributeValues.$inferSelect

// ---------- CMS Pages ----------

export const cmsPages = pgTable(
  'cms_pages',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    title: text().notNull(),
    content: text().notNull().default(''),
    excerpt: text(),
    published: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('cms_pages_slug_idx').on(t.slug)],
)

export type CmsPage = typeof cmsPages.$inferSelect
export type NewCmsPage = typeof cmsPages.$inferInsert

// ---------- Theme Sections ----------

export const themeSections = pgTable(
  'theme_sections',
  {
    id: uuid().primaryKey().defaultRandom(),
    theme: text().notNull(),
    sectionType: text('section_type').notNull(),
    position: integer().notNull().default(0),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('theme_sections_theme_idx').on(t.theme)],
)

export type ThemeSection = typeof themeSections.$inferSelect
export type NewThemeSection = typeof themeSections.$inferInsert

// ---------- Customer Addresses ----------

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: text().notNull().default('home'),
    firstName: text().notNull(),
    lastName: text().notNull(),
    line1: text().notNull(),
    line2: text(),
    city: text().notNull(),
    postalCode: text().notNull(),
    countryCode: text().notNull(),
    phone: text(),
    isDefault: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_addresses_customer_id_idx').on(t.customerId)],
)

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, { fields: [customerAddresses.customerId], references: [customers.id] }),
}))

export type CustomerAddress = typeof customerAddresses.$inferSelect
export type NewCustomerAddress = typeof customerAddresses.$inferInsert

// ---------- Wishlists ----------

export const wishlists = pgTable(
  'wishlists',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('wishlists_customer_product_idx').on(t.customerId, t.productId),
    index('wishlists_customer_id_idx').on(t.customerId),
  ],
)

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  customer: one(customers, { fields: [wishlists.customerId], references: [customers.id] }),
  product: one(products, { fields: [wishlists.productId], references: [products.id] }),
}))

export type Wishlist = typeof wishlists.$inferSelect
export type NewWishlist = typeof wishlists.$inferInsert

// ---------- Brands ----------

export const brands = pgTable(
  'brands',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    logoUrl: text(),
    websiteUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('brands_slug_idx').on(t.slug)],
)

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}))

export type Brand = typeof brands.$inferSelect
export type NewBrand = typeof brands.$inferInsert

// ---------- Suppliers ----------

export const suppliers = pgTable('suppliers', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  contactEmail: text(),
  contactPhone: text(),
  address: text(),
  notes: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const productSuppliers = pgTable(
  'product_suppliers',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid().notNull(),
    supplierId: uuid().notNull(),
    supplierSku: text(),
    costPrice: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('product_suppliers_unique_idx').on(t.productId, t.supplierId)],
)

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  productSuppliers: many(productSuppliers),
}))

export const productSuppliersRelations = relations(productSuppliers, ({ one }) => ({
  product: one(products, { fields: [productSuppliers.productId], references: [products.id] }),
  supplier: one(suppliers, { fields: [productSuppliers.supplierId], references: [suppliers.id] }),
}))

export type Supplier = typeof suppliers.$inferSelect
export type NewSupplier = typeof suppliers.$inferInsert
export type ProductSupplier = typeof productSuppliers.$inferSelect

// ---------- Marketplace — third-party sellers ----------
//
// Distinct from `suppliers` above: a supplier is who the store buys stock
// FROM (procurement bookkeeping, no auth, no storefront presence). A seller
// is a third party who lists and sells their OWN products ON this store —
// they have login credentials, own products (products.sellerId), and earn
// a commission-split payout per order rather than being paid a cost price.

export const sellerStatus = pgEnum('seller_status', ['pending', 'active', 'suspended'])
export const earningStatus = pgEnum('earning_status', ['pending', 'available', 'paid_out'])

export const sellers = pgTable(
  'sellers',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    storeName: text().notNull(),
    contactEmail: text(),
    status: sellerStatus().notNull().default('pending'),
    /** Basis points (2000 = 20%) taken by the platform. Null = use the marketplace default. */
    commissionRateBp: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sellers_email_idx').on(t.email)],
)

export const sellerPayouts = pgTable('seller_payouts', {
  id: uuid().primaryKey().defaultRandom(),
  sellerId: uuid()
    .notNull()
    .references(() => sellers.id, { onDelete: 'restrict' }),
  amount: integer().notNull(),
  currency: text().notNull(),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const sellerEarnings = pgTable(
  'seller_earnings',
  {
    id: uuid().primaryKey().defaultRandom(),
    sellerId: uuid()
      .notNull()
      .references(() => sellers.id, { onDelete: 'restrict' }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /** Sum of this seller's line items in this order, before commission. */
    grossAmount: integer().notNull(),
    commissionAmount: integer().notNull(),
    netAmount: integer().notNull(),
    currency: text().notNull(),
    status: earningStatus().notNull().default('available'),
    payoutId: uuid().references(() => sellerPayouts.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('seller_earnings_seller_order_idx').on(t.sellerId, t.orderId),
    index('seller_earnings_seller_id_idx').on(t.sellerId),
    index('seller_earnings_status_idx').on(t.status),
  ],
)

export type Seller = typeof sellers.$inferSelect
export type NewSeller = typeof sellers.$inferInsert
export type SellerEarning = typeof sellerEarnings.$inferSelect
export type SellerPayout = typeof sellerPayouts.$inferSelect

export const sellersRelations = relations(sellers, ({ many }) => ({
  products: many(products),
  earnings: many(sellerEarnings),
  payouts: many(sellerPayouts),
}))

export const sellerEarningsRelations = relations(sellerEarnings, ({ one }) => ({
  seller: one(sellers, { fields: [sellerEarnings.sellerId], references: [sellers.id] }),
  order: one(orders, { fields: [sellerEarnings.orderId], references: [orders.id] }),
  payout: one(sellerPayouts, { fields: [sellerEarnings.payoutId], references: [sellerPayouts.id] }),
}))

export const sellerPayoutsRelations = relations(sellerPayouts, ({ one, many }) => ({
  seller: one(sellers, { fields: [sellerPayouts.sellerId], references: [sellers.id] }),
  earnings: many(sellerEarnings),
}))

// ---------- Virtual products & downloads ----------

export const productDownloads = pgTable('product_downloads', {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid().notNull(),
  filename: text().notNull(),
  url: text().notNull(),
  fileSize: integer(),
  mimeType: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const downloadTokens = pgTable('download_tokens', {
  id: uuid().primaryKey().defaultRandom(),
  token: uuid().notNull(),
  customerId: uuid(),
  orderId: uuid().notNull(),
  productDownloadId: uuid().notNull(),
  downloadCount: integer().notNull().default(0),
  maxDownloads: integer().notNull().default(5),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const productDownloadsRelations = relations(productDownloads, ({ one }) => ({
  product: one(products, { fields: [productDownloads.productId], references: [products.id] }),
}))

export const downloadTokensRelations = relations(downloadTokens, ({ one }) => ({
  productDownload: one(productDownloads, {
    fields: [downloadTokens.productDownloadId],
    references: [productDownloads.id],
  }),
}))

export type ProductDownload = typeof productDownloads.$inferSelect
export type NewProductDownload = typeof productDownloads.$inferInsert
export type DownloadToken = typeof downloadTokens.$inferSelect

// ---------- Loyalty ----------

export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid().notNull(),
  balance: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid().notNull(),
  orderId: uuid(),
  type: text().notNull().$type<'earn' | 'spend' | 'adjust' | 'expire'>(),
  points: integer().notNull(),
  description: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ many }) => ({
  transactions: many(loyaltyTransactions),
}))

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  account: one(loyaltyAccounts, {
    fields: [loyaltyTransactions.accountId],
    references: [loyaltyAccounts.id],
  }),
}))

export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect

// ---------- Product Relations ----------

export const productRelationType = pgEnum('product_relation_type', [
  'related',
  'upsell',
  'cross_sell',
])

export const productRelations = pgTable(
  'product_relations',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    relatedProductId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: productRelationType().notNull().default('related'),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_relations_unique_idx').on(t.productId, t.relatedProductId, t.type),
    index('product_relations_product_id_idx').on(t.productId),
  ],
)

export const productRelationsRelations = relations(productRelations, ({ one }) => ({
  product: one(products, {
    fields: [productRelations.productId],
    references: [products.id],
    relationName: 'productRelationsSource',
  }),
  relatedProduct: one(products, {
    fields: [productRelations.relatedProductId],
    references: [products.id],
    relationName: 'productRelationsTarget',
  }),
}))

export type ProductRelation = typeof productRelations.$inferSelect

// ---------- Gift Cards ----------

export const giftCards = pgTable(
  'gift_cards',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    initialBalance: integer().notNull(),
    balance: integer().notNull(),
    currency: text().notNull(),
    issuedToEmail: text(),
    orderId: uuid(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('gift_cards_code_idx').on(t.code)],
)

export const giftCardTransactions = pgTable(
  'gift_card_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    giftCardId: uuid()
      .notNull()
      .references(() => giftCards.id, { onDelete: 'cascade' }),
    orderId: uuid(),
    amount: integer().notNull(),
    description: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('gift_card_transactions_gift_card_id_idx').on(t.giftCardId)],
)

export const giftCardsRelations = relations(giftCards, ({ many }) => ({
  transactions: many(giftCardTransactions),
}))

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
  giftCard: one(giftCards, {
    fields: [giftCardTransactions.giftCardId],
    references: [giftCards.id],
  }),
}))

export type GiftCard = typeof giftCards.$inferSelect
export type NewGiftCard = typeof giftCards.$inferInsert
export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect

// ---------- Webhooks ----------

export const webhookDeliveryStatus = pgEnum('webhook_delivery_status', [
  'pending',
  'success',
  'failed',
])

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid().primaryKey().defaultRandom(),
    url: text().notNull(),
    secret: text().notNull(),
    /** Event names this webhook subscribes to. Use ['*'] to receive all events. */
    events: text().array().notNull(),
    active: boolean().notNull().default(true),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('webhooks_active_idx').on(t.active)],
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid().primaryKey().defaultRandom(),
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text().notNull(),
    payload: jsonb().notNull(),
    status: webhookDeliveryStatus().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    responseStatus: integer(),
    responseBody: text(),
    error: text(),
    deliveredAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_deliveries_webhook_id_idx').on(t.webhookId),
    index('webhook_deliveries_event_idx').on(t.event),
    index('webhook_deliveries_status_idx').on(t.status),
  ],
)

export const webhooksRelations = relations(webhooks, ({ many }) => ({
  deliveries: many(webhookDeliveries),
}))

// ---------- Store Settings ----------
export const storeSettings = pgTable('store_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

// ---------- Feature flags ----------

export const featureFlags = pgTable('feature_flags', {
  key: text().primaryKey(),
  enabled: boolean().notNull().default(false),
  /** Gradual rollout: 0-100. Only consulted when enabled=true. */
  rolloutPercent: integer().notNull().default(100),
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type FeatureFlag = typeof featureFlags.$inferSelect
export type NewFeatureFlag = typeof featureFlags.$inferInsert

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}))

export type Webhook = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect

// ---------- Audit Log ----------

/**
 * Who performed the action. 'admin' is the master x-admin-key (no staff row),
 * 'staff' is a row in `staff` (actorId set), 'system' is server-initiated
 * (webhook retries, scheduled jobs) with no human actor.
 */
export const auditActorType = pgEnum('audit_actor_type', ['admin', 'staff', 'system'])

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorType: auditActorType().notNull(),
    /** References staff.id when actorType = 'staff'; null otherwise. Not a FK
     * so the log entry survives staff deletion — actorLabel keeps it readable. */
    actorId: uuid(),
    /** Snapshot of the actor's email/role at the time, so the entry stays
     * meaningful even after the staff row is edited or deleted. */
    actorLabel: text().notNull(),
    /** Dot-namespaced action, e.g. "order.refund", "staff.delete". */
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    /** Free-form context (amounts, previous/new values, reasons). */
    metadata: jsonb(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_action_idx').on(t.action),
  ],
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

// ---------- SEO Redirects ----------

export const redirectStatusCode = pgEnum('redirect_status_code', ['301', '302'])

export const redirects = pgTable(
  'redirects',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Path only (no domain), always starting with "/", e.g. "/old-product-slug". */
    fromPath: text().notNull(),
    /** Absolute URL or path to send visitors to. */
    toPath: text().notNull(),
    statusCode: redirectStatusCode().notNull().default('301'),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('redirects_from_path_idx').on(t.fromPath)],
)

export type Redirect = typeof redirects.$inferSelect
export type NewRedirect = typeof redirects.$inferInsert

// ---------- Category & CMS translations ----------
// Same shape as productTranslations — kept as separate tables (one per
// translatable entity type) rather than a generic polymorphic table, so each
// stays a plain FK with cascade delete instead of a loosely-typed (entityType,
// entityId) pair.

export const categoryTranslations = pgTable(
  'category_translations',
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    /** BCP 47 locale tag, e.g. "fr", "fr-FR", "en-US" */
    locale: text().notNull(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('category_translations_category_locale_idx').on(t.categoryId, t.locale),
    index('category_translations_locale_idx').on(t.locale),
  ],
)

export const cmsTranslations = pgTable(
  'cms_translations',
  {
    id: uuid().primaryKey().defaultRandom(),
    pageId: uuid()
      .notNull()
      .references(() => cmsPages.id, { onDelete: 'cascade' }),
    locale: text().notNull(),
    title: text().notNull(),
    excerpt: text(),
    content: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cms_translations_page_locale_idx').on(t.pageId, t.locale),
    index('cms_translations_locale_idx').on(t.locale),
  ],
)

export type CategoryTranslation = typeof categoryTranslations.$inferSelect
export type CmsTranslation = typeof cmsTranslations.$inferSelect

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  productCategories: many(productCategories),
  translations: many(categoryTranslations),
}))

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
}))

export const cmsPagesRelations = relations(cmsPages, ({ many }) => ({
  translations: many(cmsTranslations),
}))

export const cmsTranslationsRelations = relations(cmsTranslations, ({ one }) => ({
  page: one(cmsPages, { fields: [cmsTranslations.pageId], references: [cmsPages.id] }),
}))

// ---------- Email campaigns ----------

export const campaignStatus = pgEnum('campaign_status', ['draft', 'sending', 'sent'])
export const campaignRecipientStatus = pgEnum('campaign_recipient_status', [
  'pending',
  'sent',
  'failed',
])

export const campaigns = pgTable('campaigns', {
  id: uuid().primaryKey().defaultRandom(),
  subject: text().notNull(),
  html: text().notNull(),
  status: campaignStatus().notNull().default('draft'),
  /** null = every opted-in customer; otherwise scoped to one customer group's members. */
  audienceGroupId: uuid().references(() => customerGroups.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp({ withTimezone: true }),
})

export const campaignRecipients = pgTable(
  'campaign_recipients',
  {
    id: uuid().primaryKey().defaultRandom(),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    /** Snapshot at send time — stays correct even if the customer's email later changes. */
    email: text().notNull(),
    status: campaignRecipientStatus().notNull().default('pending'),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('campaign_recipients_campaign_customer_idx').on(t.campaignId, t.customerId),
    index('campaign_recipients_campaign_id_idx').on(t.campaignId),
  ],
)

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
export type CampaignRecipient = typeof campaignRecipients.$inferSelect

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  audienceGroup: one(customerGroups, {
    fields: [campaigns.audienceGroupId],
    references: [customerGroups.id],
  }),
  recipients: many(campaignRecipients),
}))

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignRecipients.campaignId], references: [campaigns.id] }),
  customer: one(customers, { fields: [campaignRecipients.customerId], references: [customers.id] }),
}))

// ---------- Subscriptions (recurring plan tracking + auto-billing) ----------
//
// Renewal charges a saved payment method off-session via the payment provider
// (see packages/core/src/payments/types.ts — chargeOffSession) when one is
// attached; falls back to a reminder email with a checkout link when there's
// no saved payment method, or when the off-session charge is declined.

export const subscriptionInterval = pgEnum('subscription_interval', ['weekly', 'monthly', 'yearly'])
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'paused', 'cancelled'])

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    /** Saved payment method to charge on renewal — null falls back to a reminder email. */
    paymentMethodId: uuid().references(() => customerPaymentMethods.id, { onDelete: 'set null' }),
    quantity: integer().notNull().default(1),
    interval: subscriptionInterval().notNull(),
    status: subscriptionStatus().notNull().default('active'),
    nextRenewalAt: timestamp({ withTimezone: true }).notNull(),
    lastReminderSentAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_customer_id_idx').on(t.customerId),
    index('subscriptions_next_renewal_idx').on(t.nextRenewalAt),
  ],
)

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  customer: one(customers, { fields: [subscriptions.customerId], references: [customers.id] }),
  variant: one(productVariants, {
    fields: [subscriptions.variantId],
    references: [productVariants.id],
  }),
  paymentMethod: one(customerPaymentMethods, {
    fields: [subscriptions.paymentMethodId],
    references: [customerPaymentMethods.id],
  }),
}))

// ---------- Multi-tenant — isolated stores hosted on one Redbird instance ----------
//
// tenantId is nullable everywhere it's added: null rows belong to the
// original single-tenant store (unchanged behavior for every existing
// deployment), while a specific tenant's storefront only ever sees rows
// carrying its own id. Product/category slugs and order numbers stay
// globally unique rather than per-tenant — a deliberate simplification for
// this project rather than a full enterprise rearchitecture.

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended'])

export const tenants = pgTable(
  'tenants',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Storefront subdomain / routing key, e.g. "acme" for acme.shop.example. */
    slug: text().notNull(),
    name: text().notNull(),
    status: tenantStatus().notNull().default('active'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tenants_slug_idx').on(t.slug)],
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert

export const tenantsRelations = relations(tenants, ({ many }) => ({
  products: many(products),
  categories: many(categories),
  customers: many(customers),
  orders: many(orders),
}))
