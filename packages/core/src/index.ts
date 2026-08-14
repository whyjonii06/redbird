export const VERSION = '0.0.0'

export * from './redbird.js'
export * from './config.js'
export * from './invoicing/facturx.js'
export * from './invoicing/fec.js'
export * from './plugins/index.js'
export * from './catalog/index.js'
export * from './cart/index.js'
export * from './order/index.js'
export * from './customer/index.js'
export { PaymentRegistry } from './payments/registry.js'
export type {
  PaymentIntent,
  PaymentProvider,
  WebhookHandler,
  ParsedWebhookEvent,
} from './payments/types.js'
export { EmailRegistry } from './email/registry.js'
export type { EmailMessage, EmailProvider, StoredEmail, LocalEmailStore } from './email/types.js'
export { TaxRegistry } from './tax/registry.js'
export type { TaxProvider, TaxCalculation } from './tax/types.js'
export { ShippingRegistry } from './shipping/registry.js'
export type { ShippingProvider, ShippingRate, RelayPoint } from './shipping/types.js'
export type { StockInfo, StockService } from './stock/service.js'
export type { ImageService, AddImageInput } from './catalog/images.js'
export type { ProductWithDetails, VariantAttributeValueWithRelations } from './catalog/service.js'
export type {
  PromoService,
  PromoValidation,
  CreatePromoInput,
  UpdatePromoInput,
  PromoType,
  PromoBogoConfig,
  PromoTier,
  PromoLineItem,
} from './promos/service.js'
export type { I18nService, UpsertTranslationInput } from './i18n/service.js'
export type { ReturnService, CreateReturnInput } from './returns/service.js'
export type { AbandonedCartService, AbandonedCartResult } from './abandoned-cart/service.js'
export type { StaffService, StaffMember, StaffRole, CreateStaffInput } from './staff/service.js'
export type { AttributeService, AttributeWithValues } from './attributes/service.js'
export type { AuditLogService, WriteAuditLogInput } from './audit-log/service.js'
export type { CurrencyService, CurrencyConfig } from './currency/service.js'
export type {
  WarehouseService,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseStockRow,
} from './warehouses/service.js'
export type { SearchService, ProductForIndex } from './search/service.js'
export type { LoyaltyService } from './loyalty/service.js'
export type { GiftCardService } from './gift-cards/service.js'
export type { WebhookService, CreateWebhookInput, UpdateWebhookInput } from './webhooks/service.js'
export type { BrandService, CreateBrandInput } from './brands/service.js'
export type { CmsService } from './cms/service.js'
export type { SupplierService, CreateSupplierInput, LinkProductInput } from './suppliers/service.js'
export type { DownloadService } from './downloads/service.js'

// Schema tables that modules need direct Drizzle access to (the table stays in
// the shared core schema — e.g. product_reviews is also read by the customer
// domain — while a module owns its service and API).
export { productReviews } from './db/schema.js'
export type { DbClient } from './db/client.js'

// Domain types from schema
export type {
  Address,
  Cart,
  CartLineItem,
  Category,
  Customer,
  NewCart,
  NewCartLineItem,
  NewCategory,
  NewCustomer,
  NewOrder,
  NewOrderLineItem,
  NewProduct,
  NewProductVariant,
  Order,
  OrderLineItem,
  Product,
  ProductImage,
  ProductVariant,
  PublicCustomer,
  StockLevel,
  PromoCode,
  ProductTranslation,
  ProductReview,
  ReturnRequest,
  // Loyalty
  LoyaltyAccount,
  LoyaltyTransaction,
  // Gift cards
  GiftCard,
  GiftCardTransaction,
  // Webhooks
  Webhook,
  WebhookDelivery,
  // Brands & suppliers
  Brand,
  Supplier,
  ProductSupplier,
  // CMS
  CmsPage,
  // Downloads
  ProductDownload,
  DownloadToken,
  // Attributes
  ProductAttribute,
  AttributeValue,
  // Product features
  ProductFeature,
  NewProductFeature,
  // Customer groups
  CustomerGroup,
  CustomerGroupMember,
  GroupPriceRule,
  // Wishlists
  Wishlist,
  NewWishlist,
  // Audit log
  AuditLog,
  // Warehouses
  Warehouse,
  WarehouseStock,
} from './db/schema.js'
export type { ProductFeatureService, ProductFeatureInput } from './catalog/features.js'
export type { CustomerGroupService } from './customer-groups/service.js'

// Money
export type { Money } from './money/index.js'
export { money, addMoney, multiplyMoney, zeroMoney, formatMoney } from './money/index.js'

// License
export * from './license/index.js'
