import { randomBytes } from 'node:crypto'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type Campaign,
  type CampaignRecipient,
  campaignRecipients,
  campaigns,
  customerGroupMembers,
  customers,
} from '../db/schema.js'
import type { EmailRegistry } from '../email/registry.js'

export type CampaignWithRecipientCounts = Campaign & {
  recipientCounts: { pending: number; sent: number; failed: number }
}

export type CreateCampaignInput = {
  subject: string
  html: string
  audienceGroupId?: string | undefined
}

export type SendCampaignResult = {
  audienceSize: number
  sent: number
  failed: number
}

export type CampaignService = {
  list(): Promise<CampaignWithRecipientCounts[]>
  get(id: string): Promise<CampaignWithRecipientCounts | null>
  create(input: CreateCampaignInput): Promise<Campaign>
  update(id: string, input: CreateCampaignInput): Promise<Campaign>
  delete(id: string): Promise<void>
  /** Count of opted-in customers this campaign would currently reach, without sending. */
  estimateAudience(audienceGroupId?: string | undefined): Promise<number>
  /**
   * Sends to every opted-in customer in the audience. Best-effort: a failed
   * send for one recipient doesn't stop the rest. Not queued/background — for
   * very large lists this blocks the request for the duration of the send.
   */
  send(id: string, opts?: { unsubscribeBaseUrl?: string | undefined }): Promise<SendCampaignResult>
  /** Resolves a customer from their unsubscribe link token and opts them out. Idempotent. */
  unsubscribe(token: string): Promise<boolean>
}

async function resolveAudience(db: DbClient, audienceGroupId?: string) {
  if (audienceGroupId) {
    const rows = await db
      .select({
        id: customers.id,
        email: customers.email,
        unsubscribeToken: customers.unsubscribeToken,
      })
      .from(customers)
      .innerJoin(customerGroupMembers, eq(customerGroupMembers.customerId, customers.id))
      .where(
        and(eq(customerGroupMembers.groupId, audienceGroupId), eq(customers.marketingOptIn, true)),
      )
    return rows
  }
  return db
    .select({
      id: customers.id,
      email: customers.email,
      unsubscribeToken: customers.unsubscribeToken,
    })
    .from(customers)
    .where(eq(customers.marketingOptIn, true))
}

function withUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  return `${html}
<p style="margin:32px 0 0;font-size:12px;color:#9ca3af;text-align:center">
  <a href="${unsubscribeUrl}" style="color:#9ca3af">Unsubscribe from these emails</a>
</p>`
}

export function createCampaignService(db: DbClient, email: EmailRegistry): CampaignService {
  async function withCounts(row: Campaign): Promise<CampaignWithRecipientCounts> {
    const recipients = await db.query.campaignRecipients.findMany({
      where: eq(campaignRecipients.campaignId, row.id),
      columns: { status: true },
    })
    const recipientCounts = { pending: 0, sent: 0, failed: 0 }
    for (const r of recipients) recipientCounts[r.status]++
    return { ...row, recipientCounts }
  }

  return {
    async list() {
      const rows = await db.query.campaigns.findMany({
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      })
      return Promise.all(rows.map(withCounts))
    },

    async get(id) {
      const row = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) })
      return row ? withCounts(row) : null
    },

    async create({ subject, html, audienceGroupId }) {
      const [row] = await db
        .insert(campaigns)
        .values({ subject, html, audienceGroupId: audienceGroupId ?? null })
        .returning()
      if (!row) throw new Error('Failed to create campaign')
      return row
    },

    async update(id, { subject, html, audienceGroupId }) {
      const existing = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) })
      if (!existing) throw new Error(`Campaign ${id} not found`)
      if (existing.status !== 'draft') throw new Error('Only draft campaigns can be edited')
      const [row] = await db
        .update(campaigns)
        .set({ subject, html, audienceGroupId: audienceGroupId ?? null, updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning()
      if (!row) throw new Error(`Campaign ${id} not found`)
      return row
    },

    async delete(id) {
      await db.delete(campaigns).where(eq(campaigns.id, id))
    },

    async estimateAudience(audienceGroupId) {
      const rows = await resolveAudience(db, audienceGroupId)
      return rows.length
    },

    async send(id, opts = {}) {
      const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) })
      if (!campaign) throw new Error(`Campaign ${id} not found`)
      if (campaign.status !== 'draft') throw new Error('Campaign was already sent')

      const audience = await resolveAudience(db, campaign.audienceGroupId ?? undefined)

      // Mark as sending + create pending recipient rows up front, so a crash
      // mid-send leaves a resumable record instead of silently losing state.
      await db.update(campaigns).set({ status: 'sending' }).where(eq(campaigns.id, id))
      if (audience.length > 0) {
        await db
          .insert(campaignRecipients)
          .values(audience.map((c) => ({ campaignId: id, customerId: c.id, email: c.email })))
          .onConflictDoNothing()
      }

      const provider = email.default()
      let sent = 0
      let failed = 0

      for (const customer of audience) {
        if (!provider) {
          failed++
          await markRecipient(db, id, customer.id, 'failed', 'No email provider configured')
          continue
        }

        let unsubscribeToken = customer.unsubscribeToken
        if (!unsubscribeToken) {
          unsubscribeToken = randomBytes(24).toString('hex')
          await db.update(customers).set({ unsubscribeToken }).where(eq(customers.id, customer.id))
        }
        const unsubscribeUrl = `${opts.unsubscribeBaseUrl ?? ''}/unsubscribe?token=${unsubscribeToken}`

        try {
          await provider.send({
            to: customer.email,
            subject: campaign.subject,
            html: withUnsubscribeFooter(campaign.html, unsubscribeUrl),
          })
          sent++
          await markRecipient(db, id, customer.id, 'sent')
        } catch (err) {
          failed++
          const message = err instanceof Error ? err.message : 'Send failed'
          await markRecipient(db, id, customer.id, 'failed', message)
        }
      }

      await db
        .update(campaigns)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(campaigns.id, id))

      return { audienceSize: audience.length, sent, failed }
    },

    async unsubscribe(token) {
      const [row] = await db
        .update(customers)
        .set({ marketingOptIn: false, updatedAt: new Date() })
        .where(and(eq(customers.unsubscribeToken, token), isNotNull(customers.unsubscribeToken)))
        .returning()
      return Boolean(row)
    },
  }
}

async function markRecipient(
  db: DbClient,
  campaignId: string,
  customerId: string,
  status: CampaignRecipient['status'],
  error?: string,
) {
  await db
    .update(campaignRecipients)
    .set({ status, error: error ?? null, sentAt: status === 'sent' ? new Date() : null })
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.customerId, customerId),
      ),
    )
}
