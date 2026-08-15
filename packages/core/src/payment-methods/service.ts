import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type CustomerPaymentMethod, customerPaymentMethods } from '../db/schema.js'
import type { PaymentRegistry } from '../payments/registry.js'
import type { SetupIntentResult } from '../payments/types.js'

export type PaymentMethodService = {
  list(customerId: string): Promise<CustomerPaymentMethod[]>
  getDefault(customerId: string): Promise<CustomerPaymentMethod | null>
  /**
   * Starts a save-a-card flow for a customer: reuses their existing gateway
   * customer for this provider if they have one (from a previously saved
   * card), otherwise creates one. Returns a SetupIntent — the client
   * confirms it (e.g. Stripe Elements `confirmSetup`), then calls `attach`
   * with the resulting payment method id.
   */
  createSetupIntent(
    customerId: string,
    customerEmail: string,
    providerName?: string,
  ): Promise<SetupIntentResult>
  /**
   * Persists a payment method after the client confirms a SetupIntent.
   * Always re-fetches brand/last4/expiry from the gateway rather than
   * trusting client-supplied values.
   */
  attach(
    customerId: string,
    providerName: string,
    providerCustomerId: string,
    providerPaymentMethodId: string,
  ): Promise<CustomerPaymentMethod>
  setDefault(customerId: string, id: string): Promise<void>
  remove(customerId: string, id: string): Promise<void>
}

export function createPaymentMethodService(
  db: DbClient,
  payments: PaymentRegistry,
): PaymentMethodService {
  async function list(customerId: string): Promise<CustomerPaymentMethod[]> {
    return db.query.customerPaymentMethods.findMany({
      where: eq(customerPaymentMethods.customerId, customerId),
      orderBy: (pm, { desc }) => [desc(pm.isDefault), desc(pm.createdAt)],
    })
  }

  return {
    list,

    async getDefault(customerId) {
      return (
        (await db.query.customerPaymentMethods.findFirst({
          where: and(
            eq(customerPaymentMethods.customerId, customerId),
            eq(customerPaymentMethods.isDefault, true),
          ),
        })) ?? null
      )
    },

    async createSetupIntent(customerId, customerEmail, providerName) {
      const provider = providerName ? payments.get(providerName) : payments.default()
      if (!provider) throw new Error('No payment provider configured')
      if (!provider.createSetupIntent) {
        throw new Error(
          `Payment provider "${provider.name}" does not support saved payment methods`,
        )
      }

      const existing = await db.query.customerPaymentMethods.findFirst({
        where: and(
          eq(customerPaymentMethods.customerId, customerId),
          eq(customerPaymentMethods.provider, provider.name),
        ),
      })
      const providerCustomerId =
        existing?.providerCustomerId ??
        (provider.createCustomer
          ? (await provider.createCustomer({ email: customerEmail, customerId })).id
          : (() => {
              throw new Error(
                `Payment provider "${provider.name}" cannot create a gateway customer`,
              )
            })())

      return provider.createSetupIntent({
        customerRef: providerCustomerId,
        metadata: { customerId },
      })
    },

    async attach(customerId, providerName, providerCustomerId, providerPaymentMethodId) {
      const provider = payments.get(providerName)
      if (!provider?.getPaymentMethod) {
        throw new Error(`Payment provider "${providerName}" does not support saved payment methods`)
      }
      const card = await provider.getPaymentMethod(providerPaymentMethodId)
      const isFirst = (await list(customerId)).length === 0
      const [row] = await db
        .insert(customerPaymentMethods)
        .values({
          customerId,
          provider: providerName,
          providerCustomerId,
          providerPaymentMethodId: card.id,
          brand: card.brand,
          last4: card.last4,
          expMonth: card.expMonth,
          expYear: card.expYear,
          isDefault: isFirst,
        })
        .returning()
      if (!row) throw new Error('Failed to save payment method')
      return row
    },

    async setDefault(customerId, id) {
      await db.transaction(async (tx) => {
        await tx
          .update(customerPaymentMethods)
          .set({ isDefault: false })
          .where(eq(customerPaymentMethods.customerId, customerId))
        const [row] = await tx
          .update(customerPaymentMethods)
          .set({ isDefault: true })
          .where(
            and(
              eq(customerPaymentMethods.id, id),
              eq(customerPaymentMethods.customerId, customerId),
            ),
          )
          .returning()
        if (!row) throw new Error(`Payment method ${id} not found`)
      })
    },

    async remove(customerId, id) {
      const deleted = await db
        .delete(customerPaymentMethods)
        .where(
          and(eq(customerPaymentMethods.id, id), eq(customerPaymentMethods.customerId, customerId)),
        )
        .returning()
      if (deleted.length === 0) throw new Error(`Payment method ${id} not found`)
      // Promote another saved method to default so `getDefault` doesn't go
      // stale-empty for a customer who still has cards on file.
      if (deleted[0]?.isDefault) {
        const remaining = await list(customerId)
        const next = remaining[0]
        if (next) {
          await db
            .update(customerPaymentMethods)
            .set({ isDefault: true })
            .where(eq(customerPaymentMethods.id, next.id))
        }
      }
    },
  }
}
