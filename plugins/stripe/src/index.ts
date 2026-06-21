import { createHmac, timingSafeEqual } from 'node:crypto'
import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'
import type {
  ParsedWebhookEvent,
  PaymentIntent,
  PaymentProvider,
  WebhookHandler,
} from '@redbirdshop/plugin-sdk'

const ConfigSchema = z.object({
  secretKey: z
    .string()
    .regex(/^sk_(test|live)_/, 'Stripe secret key starts with sk_test_ or sk_live_'),
  webhookSecret: z.string().optional(),
  dryRun: z.boolean().default(false),
})

export type StripeConfig = z.input<typeof ConfigSchema>
export type { PaymentIntent }

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const val = headers[name.toLowerCase()]
  return Array.isArray(val) ? val[0] : val
}

function verifyStripeSignature(
  rawBody: Buffer,
  sigHeader: string,
  secret: string,
  toleranceSecs = 300,
): void {
  const parts = sigHeader.split(',')
  const t = parts.find((p) => p.startsWith('t='))?.slice(2)
  const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))

  if (!t || signatures.length === 0) throw new Error('Invalid stripe-signature header')

  const timestamp = Number.parseInt(t, 10)
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSecs) {
    throw new Error('Stripe webhook timestamp too old (replay attack window exceeded)')
  }

  const payload = `${t}.${rawBody.toString('utf8')}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  const valid = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'hex')
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  })

  if (!valid) throw new Error('Stripe webhook signature verification failed')
}

function buildStripeWebhookHandler(webhookSecret: string): WebhookHandler {
  return {
    path: '/webhooks/stripe',
    async handle(rawBody, headers): Promise<ParsedWebhookEvent> {
      const sigHeader = getHeader(headers, 'stripe-signature')
      if (!sigHeader) throw new Error('Missing stripe-signature header')
      verifyStripeSignature(rawBody, sigHeader, webhookSecret)

      const event = JSON.parse(rawBody.toString('utf8')) as {
        type: string
        data: { object: { metadata?: Record<string, string> } }
      }

      const orderId =
        event.type === 'payment_intent.succeeded'
          ? (event.data.object.metadata?.orderId ?? null)
          : null

      return { type: event.type, orderId, raw: event }
    },
  }
}

export function stripe(input: StripeConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  async function createPaymentIntent(opts: {
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent> {
    if (config.dryRun) {
      const id = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      return {
        id,
        clientSecret: `${id}_secret_demo`,
        amount: opts.amount,
        currency: opts.currency.toLowerCase(),
        status: 'requires_payment_method',
        metadata: opts.metadata ?? {},
        provider: '@redbird/plugin-stripe',
      }
    }

    const params = new URLSearchParams()
    params.set('amount', String(opts.amount))
    params.set('currency', opts.currency.toLowerCase())
    params.set('automatic_payment_methods[enabled]', 'true')
    for (const [k, v] of Object.entries(opts.metadata ?? {})) {
      params.set(`metadata[${k}]`, v)
    }

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Stripe API ${res.status}: ${body}`)
    }
    const data = (await res.json()) as {
      id: string
      client_secret: string
      amount: number
      currency: string
      status: PaymentIntent['status']
      metadata: Record<string, string>
    }
    return {
      id: data.id,
      clientSecret: data.client_secret,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      metadata: data.metadata,
      provider: '@redbird/plugin-stripe',
    }
  }

  const provider: PaymentProvider = config.webhookSecret
    ? {
        name: '@redbird/plugin-stripe',
        createPaymentIntent,
        webhookHandler: buildStripeWebhookHandler(config.webhookSecret),
      }
    : { name: '@redbird/plugin-stripe', createPaymentIntent }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-stripe',
      version: '0.0.0',
      hooks: {
        'order.created': async ({ order }) => {
          const intent = await createPaymentIntent({
            amount: order.totalAmount,
            currency: order.currency,
            metadata: { orderId: order.id, orderNumber: order.number },
          })
          console.log(`[stripe] PaymentIntent ${intent.id} for order ${order.number}`)
        },
      },
    }),
    { config, ...provider },
  )
}
