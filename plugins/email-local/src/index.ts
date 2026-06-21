import { randomUUID } from 'node:crypto'
import {
  definePlugin,
  orderCancelledTemplate,
  orderConfirmationTemplate,
  orderFulfilledTemplate,
  orderPaidTemplate,
} from '@redbirdshop/plugin-sdk'
import type { EmailMessage, EmailProvider } from '@redbirdshop/plugin-sdk'

export type StoredEmail = {
  id: string
  to: string
  from: string
  subject: string
  html: string
  text: string | undefined
  sentAt: string // ISO string
}

export type LocalEmailStore = {
  list(): StoredEmail[]
  get(id: string): StoredEmail | null
  clear(): void
}

export type LocalEmailPlugin = ReturnType<typeof local>

export function local(opts?: { maxEmails?: number; storeName?: string; logToConsole?: boolean }) {
  const maxEmails = opts?.maxEmails ?? 100
  const storeName = opts?.storeName ?? 'Store'
  const logToConsole = opts?.logToConsole ?? true
  const store: StoredEmail[] = []

  const emailStore: LocalEmailStore = {
    list: () => [...store],
    get: (id) => store.find((e) => e.id === id) ?? null,
    clear: () => {
      store.length = 0
    },
  }

  const provider: EmailProvider & { store: LocalEmailStore } = {
    name: '@redbird/plugin-email-local',
    store: emailStore,
    async send(message: EmailMessage): Promise<void> {
      const to = Array.isArray(message.to) ? message.to.join(', ') : message.to
      const email: StoredEmail = {
        id: randomUUID(),
        to,
        from: message.from ?? 'noreply@localhost',
        subject: message.subject,
        html: message.html,
        text: message.text,
        sentAt: new Date().toISOString(),
      }
      store.unshift(email)
      if (store.length > maxEmails) store.pop()
      if (logToConsole) {
        console.log(`\n[email-local] To: ${to}`)
        console.log(`   Subject: ${message.subject}`)
        console.log(`   Stored (${store.length}/${maxEmails})\n`)
      }
    },
  }

  return Object.assign(
    definePlugin({
      name: '@redbird/plugin-email-local',
      version: '0.0.0',
      hooks: {
        'order.created': async ({ order, lineItems }) => {
          const tpl = orderConfirmationTemplate({ order, lineItems, storeName })
          await provider.send({ to: order.customerEmail, from: 'noreply@localhost', ...tpl })
        },
        'order.paid': async ({ order }) => {
          const tpl = orderPaidTemplate({ order, storeName })
          await provider.send({ to: order.customerEmail, from: 'noreply@localhost', ...tpl })
        },
        'order.fulfilled': async ({ order }) => {
          const tpl = orderFulfilledTemplate({ order, storeName })
          await provider.send({ to: order.customerEmail, from: 'noreply@localhost', ...tpl })
        },
        'order.cancelled': async ({ order }) => {
          const tpl = orderCancelledTemplate({ order, storeName })
          await provider.send({ to: order.customerEmail, from: 'noreply@localhost', ...tpl })
        },
      },
    }),
    provider,
  )
}
