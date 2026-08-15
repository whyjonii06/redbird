import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { definePlugin, definePluginConfig, z } from '@redbirdshop/plugin-sdk'
import type {
  ParsedWebhookEvent,
  PaymentIntent,
  PaymentProvider,
  SavedPaymentMethod,
  SetupIntentResult,
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

  async function refund(reference: string, amount?: number): Promise<void> {
    if (config.dryRun) return
    const params = new URLSearchParams()
    params.set('payment_intent', reference)
    if (amount != null) params.set('amount', String(amount))

    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Stripe refund API ${res.status}: ${body}`)
    }
  }

  async function stripePost(
    path: string,
    params: URLSearchParams,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const body = (await res.json()) as Record<string, unknown>
    if (!res.ok) {
      const message =
        (body.error as { message?: string } | undefined)?.message ?? JSON.stringify(body)
      throw new Error(`Stripe API ${res.status}: ${message}`)
    }
    return body
  }

  async function stripeGet(path: string): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${config.secretKey}` },
    })
    const body = (await res.json()) as Record<string, unknown>
    if (!res.ok) {
      const message =
        (body.error as { message?: string } | undefined)?.message ?? JSON.stringify(body)
      throw new Error(`Stripe API ${res.status}: ${message}`)
    }
    return body
  }

  async function createCustomer(opts: { email: string; customerId: string }): Promise<{
    id: string
  }> {
    if (config.dryRun) return { id: `cus_demo_${randomUUID().slice(0, 12)}` }
    const params = new URLSearchParams()
    params.set('email', opts.email)
    params.set('metadata[customerId]', opts.customerId)
    const data = await stripePost('customers', params)
    return { id: data.id as string }
  }

  async function createSetupIntent(opts: {
    customerRef: string
    metadata?: Record<string, string>
  }): Promise<SetupIntentResult> {
    if (config.dryRun) {
      const id = `seti_demo_${randomUUID().slice(0, 12)}`
      return {
        id,
        clientSecret: `${id}_secret_demo`,
        customerRef: opts.customerRef,
        provider: '@redbird/plugin-stripe',
      }
    }
    const params = new URLSearchParams()
    params.set('customer', opts.customerRef)
    params.set('usage', 'off_session')
    params.set('automatic_payment_methods[enabled]', 'true')
    for (const [k, v] of Object.entries(opts.metadata ?? {})) {
      params.set(`metadata[${k}]`, v)
    }
    const data = await stripePost('setup_intents', params)
    return {
      id: data.id as string,
      clientSecret: data.client_secret as string,
      customerRef: opts.customerRef,
      provider: '@redbird/plugin-stripe',
    }
  }

  async function getPaymentMethod(paymentMethodRef: string): Promise<SavedPaymentMethod> {
    if (config.dryRun) {
      // Demo cards use a `pm_demo_<brand>_<last4>` convention so the UI can
      // exercise different card brands without a real Stripe account.
      const [, brand, last4] = paymentMethodRef.match(/^pm_demo_(\w+)_(\d{4})$/) ?? []
      return {
        id: paymentMethodRef,
        brand: brand ?? 'visa',
        last4: last4 ?? '4242',
        expMonth: 12,
        expYear: 2030,
      }
    }
    const data = await stripeGet(`payment_methods/${paymentMethodRef}`)
    const card = data.card as
      | { brand?: string; last4?: string; exp_month?: number; exp_year?: number }
      | undefined
    return {
      id: data.id as string,
      brand: card?.brand ?? null,
      last4: card?.last4 ?? null,
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
    }
  }

  async function chargeOffSession(opts: {
    customerRef: string
    paymentMethodRef: string
    amount: number
    currency: string
    metadata?: Record<string, string>
  }): Promise<PaymentIntent> {
    if (config.dryRun) {
      // A demo card saved as `pm_demo_declined_<last4>` simulates a decline,
      // so the reminder-email fallback path can be exercised too.
      const declined = opts.paymentMethodRef.startsWith('pm_demo_declined_')
      const id = `pi_demo_${randomUUID().slice(0, 12)}`
      return {
        id,
        clientSecret: `${id}_secret_demo`,
        amount: opts.amount,
        currency: opts.currency.toLowerCase(),
        status: declined ? 'requires_payment_method' : 'succeeded',
        metadata: opts.metadata ?? {},
        provider: '@redbird/plugin-stripe',
      }
    }
    const params = new URLSearchParams()
    params.set('amount', String(opts.amount))
    params.set('currency', opts.currency.toLowerCase())
    params.set('customer', opts.customerRef)
    params.set('payment_method', opts.paymentMethodRef)
    params.set('off_session', 'true')
    params.set('confirm', 'true')
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
    const data = (await res.json()) as {
      id?: string
      client_secret?: string
      amount?: number
      currency?: string
      status?: PaymentIntent['status']
      metadata?: Record<string, string>
      error?: { message?: string; code?: string; payment_intent?: { id: string } }
    }
    // A decline (including one requiring fresh 3DS auth) is a normal outcome
    // here, not a thrown error — the caller decides whether to fall back to a
    // reminder email. Only a malformed/unexpected response throws.
    if (!res.ok) {
      if (data.error?.payment_intent) {
        const pi = data.error.payment_intent
        return {
          id: pi.id,
          clientSecret: '',
          amount: opts.amount,
          currency: opts.currency.toLowerCase(),
          status: 'requires_payment_method',
          metadata: opts.metadata ?? {},
          provider: '@redbird/plugin-stripe',
        }
      }
      throw new Error(`Stripe API ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`)
    }
    return {
      id: data.id as string,
      clientSecret: data.client_secret ?? '',
      amount: data.amount as number,
      currency: data.currency as string,
      status: data.status as PaymentIntent['status'],
      metadata: data.metadata ?? {},
      provider: '@redbird/plugin-stripe',
    }
  }

  const provider: PaymentProvider = config.webhookSecret
    ? {
        name: '@redbird/plugin-stripe',
        createPaymentIntent,
        refund,
        createCustomer,
        createSetupIntent,
        getPaymentMethod,
        chargeOffSession,
        webhookHandler: buildStripeWebhookHandler(config.webhookSecret),
      }
    : {
        name: '@redbird/plugin-stripe',
        createPaymentIntent,
        refund,
        createCustomer,
        createSetupIntent,
        getPaymentMethod,
        chargeOffSession,
      }

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
