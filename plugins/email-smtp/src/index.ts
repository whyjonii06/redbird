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
import { createTransport } from 'nodemailer'

const ConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().default(587),
  secure: z.boolean().default(false),
  user: z.string().min(1),
  password: z.string().min(1),
  from: z.string().email('from must be a valid email address'),
  storeName: z.string().default('Store'),
  primaryColor: z.string().optional(),
})

export type SmtpConfig = z.input<typeof ConfigSchema>

export function smtp(input: SmtpConfig) {
  const config = definePluginConfig(ConfigSchema, input)

  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  })

  const provider: EmailProvider = {
    name: '@redbird/plugin-email-smtp',
    async send(message: EmailMessage): Promise<void> {
      const to = Array.isArray(message.to) ? message.to.join(', ') : message.to
      await transporter.sendMail({
        from: message.from ?? config.from,
        to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
    },
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-email-smtp',
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
