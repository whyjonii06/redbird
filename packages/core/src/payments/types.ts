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

export interface PaymentProvider {
  readonly name: string
  readonly webhookHandler?: WebhookHandler
  createPaymentIntent(opts: {
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent>
}
