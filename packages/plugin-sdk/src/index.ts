// Re-export plugin/module authoring API from core
export { definePlugin, defineModule } from '@redbirdshop/core'
export type {
  PluginDefinition,
  PluginSetupContext,
  ModuleDefinition,
  ModuleMigration,
  ModuleMenuEntry,
  ModuleManifest,
  HookMap,
  HookName,
  HookHandler,
  HookHandlers,
} from '@redbirdshop/core'

// Re-export domain types plugins may need
export type {
  Cart,
  CartLineItem,
  Order,
  OrderLineItem,
  Product,
  ProductVariant,
  Money,
} from '@redbirdshop/core'

// Payment provider contract
export type {
  PaymentIntent,
  PaymentProvider,
  WebhookHandler,
  ParsedWebhookEvent,
  SavedPaymentMethod,
  SetupIntentResult,
} from './payment.js'

// Email provider contract
export type { EmailMessage, EmailProvider } from '@redbirdshop/core'

// Default transactional email templates
export {
  orderConfirmationTemplate,
  orderPaidTemplate,
  orderFulfilledTemplate,
  orderCancelledTemplate,
} from './email-templates.js'

// Helpers
export { defineConfig as definePluginConfig } from './config.js'
export { z } from 'zod'
