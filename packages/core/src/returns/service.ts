import { and, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type ReturnRequest, returnRequests } from '../db/schema.js'

export type CreateReturnInput = {
  orderId: string
  reason: string
}

export type ReturnService = {
  create(input: CreateReturnInput): Promise<ReturnRequest>
  list(opts?: {
    orderId?: string | undefined
    status?: ReturnRequest['status'] | undefined
  }): Promise<ReturnRequest[]>
  get(id: string): Promise<ReturnRequest | null>
  approve(id: string, adminNote?: string): Promise<ReturnRequest>
  reject(id: string, adminNote?: string): Promise<ReturnRequest>
}

export function createReturnService(db: DbClient): ReturnService {
  return {
    async create({ orderId, reason }) {
      const [req] = await db.insert(returnRequests).values({ orderId, reason }).returning()
      if (!req) throw new Error('Failed to create return request')
      return req
    },

    async list({ orderId, status } = {}) {
      return db.query.returnRequests.findMany({
        where:
          orderId && status
            ? and(eq(returnRequests.orderId, orderId), eq(returnRequests.status, status))
            : orderId
              ? eq(returnRequests.orderId, orderId)
              : status
                ? eq(returnRequests.status, status)
                : undefined,
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      })
    },

    async get(id) {
      const row = await db.query.returnRequests.findFirst({
        where: eq(returnRequests.id, id),
      })
      return row ?? null
    },

    async approve(id, adminNote) {
      const [req] = await db
        .update(returnRequests)
        .set({ status: 'approved', adminNote: adminNote ?? null, updatedAt: new Date() })
        .where(eq(returnRequests.id, id))
        .returning()
      if (!req) throw new Error(`Return request ${id} not found`)
      return req
    },

    async reject(id, adminNote) {
      const [req] = await db
        .update(returnRequests)
        .set({ status: 'rejected', adminNote: adminNote ?? null, updatedAt: new Date() })
        .where(eq(returnRequests.id, id))
        .returning()
      if (!req) throw new Error(`Return request ${id} not found`)
      return req
    },
  }
}
