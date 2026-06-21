import { createHmac, randomBytes } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type Webhook,
  type WebhookDelivery,
  webhookDeliveries,
  webhooks,
} from '../db/schema.js'

export type { Webhook, WebhookDelivery }

export type CreateWebhookInput = {
  url: string
  /** HMAC-SHA256 signing secret. Auto-generated if omitted. */
  secret?: string | undefined
  /** Event names to subscribe to, or ['*'] to receive all events. */
  events: string[]
  description?: string | undefined
  active?: boolean | undefined
}

export type UpdateWebhookInput = {
  url?: string | undefined
  events?: string[] | undefined
  active?: boolean | undefined
  description?: string | null | undefined
}

export type WebhookService = {
  create(input: CreateWebhookInput): Promise<Webhook>
  list(): Promise<Webhook[]>
  get(id: string): Promise<Webhook | null>
  update(id: string, patch: UpdateWebhookInput): Promise<Webhook>
  delete(id: string): Promise<void>
  /**
   * Forward an event to all matching active webhooks.
   * Never throws — delivery failures are stored in webhook_deliveries.
   */
  dispatch(event: string, payload: unknown): Promise<void>
  listDeliveries(
    webhookId: string,
    opts?: { limit?: number | undefined; status?: WebhookDelivery['status'] | undefined },
  ): Promise<WebhookDelivery[]>
  /** Retry a failed delivery with the original payload. */
  redeliver(deliveryId: string): Promise<WebhookDelivery>
}

const TIMEOUT_MS = 5_000

function sign(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

type DeliveryResult =
  | { ok: true; responseStatus: number; responseBody: string }
  | { ok: false; error: string }

async function sendRequest(webhook: Webhook, event: string, payload: unknown): Promise<DeliveryResult> {
  const body = JSON.stringify(payload)
  const deliveryId = randomBytes(8).toString('hex')
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Redbird-Event': event,
        'X-Redbird-Delivery': deliveryId,
        'X-Redbird-Signature': sign(webhook.secret, body),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const responseBody = await res.text().catch(() => '')
    const ok = res.status < 300
    if (ok) {
      return { ok: true as const, responseStatus: res.status, responseBody: responseBody.slice(0, 2000) }
    }
    return { ok: false as const, error: `HTTP ${res.status}: ${responseBody.slice(0, 500)}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function createWebhookService(db: DbClient): WebhookService {
  async function insertDelivery(
    webhook: Webhook,
    event: string,
    payload: unknown,
  ): Promise<WebhookDelivery> {
    const result = await sendRequest(webhook, event, payload)
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        event,
        payload: payload as Record<string, unknown>,
        status: result.ok ? 'success' : 'failed',
        attempts: 1,
        responseStatus: result.ok ? result.responseStatus : null,
        responseBody: result.ok ? result.responseBody : null,
        error: result.ok ? null : result.error,
        deliveredAt: result.ok ? new Date() : null,
      })
      .returning()
    if (!delivery) throw new Error('Failed to insert delivery record')
    return delivery
  }

  async function updateDelivery(
    deliveryId: string,
    result: DeliveryResult,
  ): Promise<WebhookDelivery> {
    const [updated] = await db
      .update(webhookDeliveries)
      .set({
        status: result.ok ? 'success' : 'failed',
        attempts: sql`${webhookDeliveries.attempts} + 1`,
        responseStatus: result.ok ? result.responseStatus : null,
        responseBody: result.ok ? result.responseBody : null,
        error: result.ok ? null : result.error,
        deliveredAt: result.ok ? new Date() : null,
      })
      .where(eq(webhookDeliveries.id, deliveryId))
      .returning()
    if (!updated) throw new Error('Delivery record not found')
    return updated
  }

  return {
    async create(input) {
      const secret = input.secret ?? randomBytes(32).toString('hex')
      const [webhook] = await db
        .insert(webhooks)
        .values({
          url: input.url,
          secret,
          events: input.events,
          active: input.active ?? true,
          description: input.description ?? null,
        })
        .returning()
      if (!webhook) throw new Error('Failed to create webhook')
      return webhook
    },

    async list() {
      return db.query.webhooks.findMany({
        orderBy: (w, { desc: d }) => [d(w.createdAt)],
      })
    },

    async get(id) {
      const row = await db.query.webhooks.findFirst({ where: eq(webhooks.id, id) })
      return row ?? null
    },

    async update(id, patch) {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.url !== undefined) set.url = patch.url
      if (patch.events !== undefined) set.events = patch.events
      if (patch.active !== undefined) set.active = patch.active
      if ('description' in patch) set.description = patch.description ?? null
      const [webhook] = await db
        .update(webhooks)
        .set(set)
        .where(eq(webhooks.id, id))
        .returning()
      if (!webhook) throw new Error(`Webhook ${id} not found`)
      return webhook
    },

    async delete(id) {
      await db.delete(webhooks).where(eq(webhooks.id, id))
    },

    async dispatch(event, payload) {
      let matching: Webhook[]
      try {
        const all = await db.query.webhooks.findMany({
          where: eq(webhooks.active, true),
        })
        matching = all.filter((w) => w.events.includes('*') || w.events.includes(event))
      } catch {
        return // DB unavailable — fail silently
      }
      await Promise.allSettled(matching.map((w) => insertDelivery(w, event, payload)))
    },

    async listDeliveries(webhookId, { limit = 20, status } = {}) {
      return db.query.webhookDeliveries.findMany({
        where: status
          ? and(eq(webhookDeliveries.webhookId, webhookId), eq(webhookDeliveries.status, status))
          : eq(webhookDeliveries.webhookId, webhookId),
        orderBy: [desc(webhookDeliveries.createdAt)],
        limit,
      })
    },

    async redeliver(deliveryId) {
      const delivery = await db.query.webhookDeliveries.findFirst({
        where: eq(webhookDeliveries.id, deliveryId),
        with: { webhook: true },
      })
      if (!delivery) throw new Error(`Delivery ${deliveryId} not found`)
      const result = await sendRequest(delivery.webhook, delivery.event, delivery.payload)
      return updateDelivery(deliveryId, result)
    },
  }
}
