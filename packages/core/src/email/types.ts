export type EmailMessage = {
  to: string | string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text?: string
}

export type EmailProvider = {
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

export type StoredEmail = {
  id: string
  to: string
  from: string
  subject: string
  html: string
  text: string | undefined
  sentAt: string
}

export type LocalEmailStore = {
  list(): StoredEmail[]
  get(id: string): StoredEmail | null
  clear(): void
}
