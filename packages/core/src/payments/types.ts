export type PaymentIntent = {
  readonly id: string
  readonly clientSecret: string
  readonly amount: number
  readonly currency: string
  readonly status: 'requires_payment_method' | 'succeeded' | 'canceled'
  readonly metadata: Readonly<Record<string, string>>
  readonly provider: string
}

export type ParsedWebhookEvent = {
  readonly type: string
  readonly orderId: string | null
  readonly raw: unknown
}

export interface WebhookHandler {
  readonly path: string
  handle(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<ParsedWebhookEvent>
}

/** A gateway-side saved card, fetched fresh from the provider — never trust
 * client-supplied brand/last4, since the client controls that request. */
export type SavedPaymentMethod = {
  readonly id: string
  readonly brand: string | null
  readonly last4: string | null
  readonly expMonth: number | null
  readonly expYear: number | null
}

export type SetupIntentResult = {
  readonly id: string
  readonly clientSecret: string
  readonly customerRef: string
  readonly provider: string
}

export interface PaymentProvider {
  readonly name: string
  readonly webhookHandler?: WebhookHandler
  createPaymentIntent(opts: {
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent>
  /**
   * Optional capability: issue a real refund at the payment gateway for a previously
   * created payment (identified by the PaymentIntent id returned from createPaymentIntent).
   * Omit `amount` for a full refund.
   */
  refund?(reference: string, amount?: number): Promise<void>
  /**
   * Optional capability: create (or reuse) a gateway-side customer record —
   * a prerequisite for saving a payment method against that customer.
   */
  createCustomer?(opts: { email: string; customerId: string }): Promise<{ id: string }>
  /**
   * Optional capability: start a save-a-card flow. No charge happens here —
   * the client confirms the returned clientSecret (e.g. Stripe Elements
   * `confirmSetup`), then the caller fetches the resulting payment method
   * via `getPaymentMethod`.
   */
  createSetupIntent?(opts: {
    customerRef: string
    metadata?: Record<string, string>
  }): Promise<SetupIntentResult>
  /** Optional capability: fetch a saved payment method's display details. */
  getPaymentMethod?(paymentMethodRef: string): Promise<SavedPaymentMethod>
  /**
   * Optional capability: charge a previously-saved payment method without
   * customer interaction (subscription renewals, one-click reorder). May
   * fail with `requires_action` for cards needing fresh 3DS — callers should
   * treat a non-`succeeded` status as a failed charge, not retry blindly.
   */
  chargeOffSession?(opts: {
    customerRef: string
    paymentMethodRef: string
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent>
  /**
   * Optional capability: a hosted, redirect-based checkout page — the flow
   * used by the headless reference storefronts (they never hold gateway
   * credentials themselves, only orderId/success/cancel URLs). Distinct from
   * createPaymentIntent, which backs the embedded Stripe Elements flow.
   */
  createCheckoutSession?(opts: {
    orderId: string
    amount: number
    currency: string
    customerEmail: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string | null }>
  /**
   * Optional capability: verify a hosted checkout session actually paid the
   * order it claims to, for createCheckoutSession's redirect-back leg.
   */
  getCheckoutSession?(
    sessionId: string,
  ): Promise<{ paid: boolean; orderId: string | null; reference: string }>
}
