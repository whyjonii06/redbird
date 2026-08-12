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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_email_idx').on(t.email)],
)

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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_status_idx').on(t.status),
    index('products_brand_id_idx').on(t.brandId),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categories_slug_idx').on(t.slug),
    index('categories_parent_id_idx').on(t.parentId),
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

export const discountType = pgEnum('discount_type', ['percentage', 'fixed'])

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    type: discountType().notNull(),
    /** Percentage: 0–100. Fixed: amount in smallest currency unit. */
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('carts_customer_id_idx').on(t.customerId), index('carts_status_idx').on(t.status)],
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.number),
    uniqueIndex('orders_invoice_number_idx').on(t.invoiceNumber),
    index('orders_customer_id_idx').on(t.customerId),
    index('orders_status_idx').on(t.status),
    index('orders_created_at_idx').on(t.createdAt),
  ],
)

/** Atomic, gapless sequence counters (e.g. legal invoice numbering per year). */
export const counters = pgTable('counters', {
  key: text().primaryKey(),
  value: integer().notNull().default(0),
})

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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_line_items_order_id_idx').on(t.orderId)],
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('group_price_rules_group_variant_idx').on(t.groupId, t.variantId),
    index('group_price_rules_group_id_idx').on(t.groupId),
    index('group_price_rules_variant_id_idx').on(t.variantId),
  ],
)

// ---------- Relations ----------

export const customersRelations = relations(customers, ({ many }) => ({
  carts: many(carts),
  orders: many(orders),
  groupMemberships: many(customerGroupMembers),
  wishlists: many(wishlists),
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

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  productCategories: many(productCategories),
}))

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

export const ordersRelations = relations(orders, ({ many }) => ({
  lineItems: many(orderLineItems),
}))

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
}))

// ---------- Types ----------

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type PublicCustomer = Omit<Customer, 'passwordHash' | 'resetToken' | 'resetTokenExpiresAt'>

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

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(products, { fields: [productReviews.productId], references: [products.id] }),
  customer: one(customers, { fields: [productReviews.customerId], references: [customers.id] }),
}))

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
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

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}))

export type Webhook = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
