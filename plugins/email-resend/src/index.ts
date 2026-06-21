import {
  definePlugin,
  definePluginConfig,
  orderCancelledTemplate,
  orderConfirmationTemplate,
  orderFulfilledTemplate,
  orderPaidTemplate,
  z,
} from '@redbirdshop/plugin-sdk'
import type { EmailMessage, EmailProvider } from '@redbirdshop/plugin-sdk'

const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'Resend API key is required'),
  from: z.string().email('from must be a valid email address'),
  storeName: z.string().default('Store'),
  primaryColor: z.string().optional(),
  /** When true, emails are logged to console instead of sent to Resend. Useful for tests and local dev. */
  dryRun: z.boolean().default(false),
})

export type ResendConfig = z.input<typeof ConfigSchema>

async function callResend(apiKey: string, message: EmailMessage): Promise<void> {
  const to = Array.isArray(message.to) ? message.to : [message.to]
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to,
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend API ${res.status}: ${body}`)
  }
}

export function resend(input: ResendConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  const provider: EmailProvider = {
    name: '@redbird/plugin-email-resend',
    async send(message: EmailMessage): Promise<void> {
      const msg = { ...message, from: message.from ?? config.from }
      if (config.dryRun) {
        console.log(
          `[resend:dryRun] to=${Array.isArray(msg.to) ? msg.to.join(',') : msg.to} subject="${msg.subject}"`,
        )
        return
      }
      await callResend(config.apiKey, msg)
    },
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-email-resend',
      version: '0.0.0',
      hooks: {
        'order.created': async ({ order, lineItems }) => {
          const tpl = orderConfirmationTemplate({ order, lineItems, storeName: config.storeName, primaryColor: config.primaryColor })
          await provider.send({ to: order.customerEmail, from: config.from, ...tpl })
        },
        'order.paid': async ({ order }) => {
          const tpl = orderPaidTemplate({ order, storeName: config.storeName, primaryColor: config.primaryColor })
          await provider.send({ to: order.customerEmail, from: config.from, ...tpl })
        },
        'order.fulfilled': async ({ order }) => {
          const tpl = orderFulfilledTemplate({ order, storeName: config.storeName, primaryColor: config.primaryColor })
          await provider.send({ to: order.customerEmail, from: config.from, ...tpl })
        },
        'order.cancelled': async ({ order }) => {
          const tpl = orderCancelledTemplate({ order, storeName: config.storeName, primaryColor: config.primaryColor })
          await provider.send({ to: order.customerEmail, from: config.from, ...tpl })
        },
      },
    }),
    provider,
  )
}
