import { and, desc, eq, lt } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type AuditLog, auditLogs } from '../db/schema.js'

export type WriteAuditLogInput = {
  actorType: AuditLog['actorType']
  /** Staff id when actorType = 'staff'; omit for 'admin'/'system'. */
  actorId?: string | undefined
  /** Human-readable actor snapshot, e.g. the staff email or "Master admin key". */
  actorLabel: string
  /** Dot-namespaced action, e.g. "order.refund", "staff.delete". */
  action: string
  entityType: string
  entityId?: string | undefined
  metadata?: Record<string, unknown> | undefined
  ip?: string | undefined
}

export type AuditLogService = {
  write(input: WriteAuditLogInput): Promise<void>
  list(opts?: {
    entityType?: string | undefined
    entityId?: string | undefined
    action?: string | undefined
    before?: Date | undefined
    limit?: number | undefined
  }): Promise<AuditLog[]>
}

export function createAuditLogService(db: DbClient): AuditLogService {
  return {
    async write(input) {
      // Audit logging must never break the action it's observing — a failed
      // write here (e.g. a transient DB hiccup) is logged and swallowed.
      try {
        await db.insert(auditLogs).values({
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          actorLabel: input.actorLabel,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? null,
          ip: input.ip ?? null,
        })
      } catch (err) {
        console.error('[audit-log] failed to write entry', err)
      }
    },

    async list(opts = {}) {
      const { entityType, entityId, action, before, limit = 50 } = opts
      const conditions = [
        entityType ? eq(auditLogs.entityType, entityType) : undefined,
        entityId ? eq(auditLogs.entityId, entityId) : undefined,
        action ? eq(auditLogs.action, action) : undefined,
        before ? lt(auditLogs.createdAt, before) : undefined,
      ].filter((c) => c !== undefined)

      return db.query.auditLogs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(auditLogs.createdAt)],
        limit,
      })
    },
  }
}
