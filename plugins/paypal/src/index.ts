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
    // PayPal amounts are decimal strings (e.g. "12.99"), not integer minor units
    const decimalAmount = (opts.amount / 100).toFixed(2)

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
      status: 'requires_payment_method',
      metadata: opts.metadata ?? {},
      provider: '@redbird/plugin-paypal',
    }
  }

  function buildWebhookHandler(webhookId: string): WebhookHandler {
    return {
      path: '/webhooks/paypal',
      async handle(rawBody, headers): Promise<ParsedWebhookEvent> {
        if (!config.dryRun) {
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
        webhookHandler: buildWebhookHandler(config.webhookId),
      }
    : { name: '@redbird/plugin-paypal', createPaymentIntent }

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
