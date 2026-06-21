import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const licenses = sqliteTable('licenses', {
  id: text('id').primaryKey(),  // UUID
  key: text('key').notNull().unique(),  // rb_live_xxx ou rb_test_xxx
  email: text('email').notNull(),
  plan: text('plan', { enum: ['free', 'pro'] }).notNull().default('pro'),
  status: text('status', { enum: ['active', 'cancelled', 'past_due', 'trialing'] }).notNull().default('active'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  expiresAt: text('expires_at'),  // ISO string ou null (abonnement actif)
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export type License = typeof licenses.$inferSelect
export type NewLicense = typeof licenses.$inferInsert
