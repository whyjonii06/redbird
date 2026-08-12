import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'
import type {
  ParsedWebhookEvent,
  PaymentIntent,
  PaymentProvider,
  WebhookHandler,
} from '@redbirdshop/plugin-sdk'

const ConfigSchema = z.object({
  clientId: z.string().min(1, 'PayPal client ID is required'),
  clientSecret: z.string().min(1, 'PayPal client secret is required'),
  /** Webhook ID from the PayPal dashboard — enables webhook signature verification. */
  webhookId: z.string().optional(),
  /** Use PayPal sandbox (test) environment. Defaults to true. */
  sandbox: z.boolean().default(true),
  /** When true, never reaches out to PayPal — returns stub orders and skips webhook verification. */
  dryRun: z.boolean().default(false),
})

export type PayPalConfig = z.input<typeof ConfigSchema>
export type { PaymentIntent }

/** Currencies PayPal expects as whole numbers, with no decimal subunit. */
const ZERO_DECIMAL_CURRENCIES = new Set(['HUF', 'JPY', 'TWD'])

function toPayPalDecimalAmount(amountMinorUnits: number, currency: string): string {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? String(amountMinorUnits)
    : (amountMinorUnits / 100).toFixed(2)
}

function toPaymentIntentStatus(paypalStatus: string): PaymentIntent['status'] {
  if (paypalStatus === 'COMPLETED') return 'succeeded'
  if (paypalStatus === 'VOIDED') return 'canceled'
  return 'requires_payment_method'
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const val = headers[name.toLowerCase()]
  return Array.isArray(val) ? val[0] : val
}

function extractPayPalOrderId(event: {
  event_type: string
  resource: unknown
}): string | null {
  const resource = event.resource as Record<string, unknown>

  if (
    event.event_type === 'CHECKOUT.ORDER.COMPLETED' ||
    event.event_type === 'CHECKOUT.ORDER.APPROVED'
  ) {
    const units = resource.purchase_units as Array<{ custom_id?: string }> | undefined
    return units?.[0]?.custom_id ?? null
  }

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    return (resource.custom_id as string | undefined) ?? null
  }

  return null
}

export function paypal(input: PayPalConfig) {
  const config = definePluginConfig(ConfigSchema, input)
  const baseUrl = config.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

  async function getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`PayPal auth ${res.status}: ${body}`)
    }
    const data = (await res.json()) as { access_token: string }
    return data.access_token
  }

  async function createPaymentIntent(opts: {
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent> {
    if (config.dryRun) {
      const id = `paypal_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      return {
        id,
        clientSecret: id,
        amount: opts.amount,
        currency: opts.currency.toUpperCase(),
        status: 'requires_payment_method',
        metadata: opts.metadata ?? {},
        provider: '@redbird/plugin-paypal',
      }
    }

    const token = await getAccessToken()
    // PayPal amounts are decimal strings (e.g. "12.99"), not integer minor units —
    // except for zero-decimal currencies (JPY, HUF, TWD), which are sent as whole numbers.
    const decimalAmount = toPayPalDecimalAmount(opts.amount, opts.currency)

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': opts.metadata?.orderId ?? `redbird-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: opts.metadata?.orderId,
            amount: {
              currency_code: opts.currency.toUpperCase(),
              value: decimalAmount,
            },
          },
        ],
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`PayPal API ${res.status}: ${body}`)
    }
    const data = (await res.json()) as { id: string; status: string }

    return {
      id: data.id,
      clientSecret: data.id,
      amount: opts.amount,
      currency: opts.currency.toUpperCase(),
      status: toPaymentIntentStatus(data.status),
      metadata: opts.metadata ?? {},
      provider: '@redbird/plugin-paypal',
    }
  }

  /**
   * PayPal refunds target a *capture* id, not the order id returned by createPaymentIntent —
   * look it up from the order before refunding. `amount` is in minor units (cents); omit for
   * a full refund.
   */
  async function refund(reference: string, amount?: number): Promise<void> {
    if (config.dryRun) return
    const token = await getAccessToken()

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${reference}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!orderRes.ok) {
      const body = await orderRes.text()
      throw new Error(`PayPal order lookup ${orderRes.status}: ${body}`)
    }
    const order = (await orderRes.json()) as {
      purchase_units?: Array<{
        payments?: { captures?: Array<{ id: string; amount: { currency_code: string } }> }
      }>
    }
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
    if (!capture) throw new Error(`PayPal order ${reference} has no captured payment to refund`)

    const body: { amount?: { value: string; currency_code: string } } = {}
    if (amount != null) {
      body.amount = {
        value: toPayPalDecimalAmount(amount, capture.amount.currency_code),
        currency_code: capture.amount.currency_code,
      }
    }

    const refundRes = await fetch(`${baseUrl}/v2/payments/captures/${capture.id}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!refundRes.ok) {
      const errBody = await refundRes.text()
      throw new Error(`PayPal refund API ${refundRes.status}: ${errBody}`)
    }
  }

  function buildWebhookHandler(webhookId: string): WebhookHandler {
    return {
      path: '/webhooks/paypal',
      async handle(rawBody, headers): Promise<ParsedWebhookEvent> {
        // Signature verification always runs when a webhookId is configured (which is the
        // only way this handler gets built) — `dryRun` only stubs createPaymentIntent to
        // avoid real PayPal API calls, it must never bypass trusting incoming webhooks.
        const token = await getAccessToken()
        const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_algo: getHeader(headers, 'paypal-auth-algo'),
            cert_url: getHeader(headers, 'paypal-cert-url'),
            transmission_id: getHeader(headers, 'paypal-transmission-id'),
            transmission_sig: getHeader(headers, 'paypal-transmission-sig'),
            transmission_time: getHeader(headers, 'paypal-transmission-time'),
            webhook_id: webhookId,
            webhook_event: JSON.parse(rawBody.toString('utf8')),
          }),
        })
        if (!verifyRes.ok) {
          throw new Error(`PayPal verification request failed: ${verifyRes.status}`)
        }
        const result = (await verifyRes.json()) as { verification_status: string }
        if (result.verification_status !== 'SUCCESS') {
          throw new Error(
            `PayPal webhook signature verification failed: ${result.verification_status}`,
          )
        }

        const event = JSON.parse(rawBody.toString('utf8')) as {
          event_type: string
          resource: unknown
        }
        const orderId = extractPayPalOrderId(event)
        return { type: event.event_type, orderId, raw: event }
      },
    }
  }

  const provider: PaymentProvider = config.webhookId
    ? {
        name: '@redbird/plugin-paypal',
        createPaymentIntent,
        refund,
        webhookHandler: buildWebhookHandler(config.webhookId),
      }
    : { name: '@redbird/plugin-paypal', createPaymentIntent, refund }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-paypal',
      version: '0.0.0',
      hooks: {
        'order.created': async ({ order }) => {
          const intent = await createPaymentIntent({
            amount: order.totalAmount,
            currency: order.currency,
            metadata: { orderId: order.id, orderNumber: order.number },
          })
          console.log(`[paypal] Order ${intent.id} for order ${order.number}`)
        },
      },
    }),
    { config, ...provider },
  )
}
