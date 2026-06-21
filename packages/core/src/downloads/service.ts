import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type DownloadToken,
  type ProductDownload,
  downloadTokens,
  orderLineItems,
  orders,
  productDownloads,
  productVariants,
  products,
} from '../db/schema.js'

export type DownloadService = {
  getForProduct(productId: string): Promise<ProductDownload[]>
  addFile(
    productId: string,
    input: {
      filename: string
      url: string
      fileSize?: number | undefined
      mimeType?: string | undefined
    },
  ): Promise<ProductDownload>
  removeFile(id: string): Promise<void>
  generateTokensForOrder(orderId: string): Promise<void>
  getTokensForOrder(orderId: string): Promise<(DownloadToken & { productDownload: ProductDownload })[]>
  redeemToken(token: string): Promise<{ url: string; filename: string } | null>
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function createDownloadService(db: DbClient): DownloadService {
  return {
    async getForProduct(productId) {
      return db.query.productDownloads.findMany({
        where: eq(productDownloads.productId, productId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      })
    },

    async addFile(productId, input) {
      const values: typeof productDownloads.$inferInsert = {
        productId,
        filename: input.filename,
        url: input.url,
      }
      if (input.fileSize !== undefined) values.fileSize = input.fileSize
      if (input.mimeType !== undefined) values.mimeType = input.mimeType
      const [row] = await db.insert(productDownloads).values(values).returning()
      if (!row) throw new Error('Failed to add download file')
      return row
    },

    async removeFile(id) {
      await db.delete(productDownloads).where(eq(productDownloads.id, id))
    },

    async generateTokensForOrder(orderId) {
      const lineItems = await db.query.orderLineItems.findMany({
        where: eq(orderLineItems.orderId, orderId),
      })
      if (lineItems.length === 0) return

      const variantIds = lineItems.map((li) => li.variantId).filter((id): id is string => id !== null)
      if (variantIds.length === 0) return
      const variants = await db.query.productVariants.findMany({
        where: inArray(productVariants.id, variantIds),
      })

      const productIds = [...new Set(variants.map((v) => v.productId))]
      const virtualProducts = await db.query.products.findMany({
        where: inArray(products.id, productIds),
        columns: { id: true, isVirtual: true },
      })
      const virtualProductIds = new Set(
        virtualProducts.filter((p) => p.isVirtual).map((p) => p.id),
      )
      if (virtualProductIds.size === 0) return

      const virtualVariantProductIds = variants
        .filter((v) => virtualProductIds.has(v.productId))
        .map((v) => v.productId)

      const files = await db.query.productDownloads.findMany({
        where: inArray(productDownloads.productId, virtualVariantProductIds),
      })
      if (files.length === 0) return

      // Load order to get customerId
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        columns: { customerId: true },
      })

      const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS)
      const tokenRows: (typeof downloadTokens.$inferInsert)[] = files.map((f) => {
        const values: typeof downloadTokens.$inferInsert = {
          token: randomUUID(),
          orderId,
          productDownloadId: f.id,
          expiresAt,
        }
        if (order?.customerId) values.customerId = order.customerId
        return values
      })

      await db.insert(downloadTokens).values(tokenRows).onConflictDoNothing()
    },

    async getTokensForOrder(orderId) {
      const rows = await db.query.downloadTokens.findMany({
        where: eq(downloadTokens.orderId, orderId),
        with: { productDownload: true },
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      })
      return rows as (DownloadToken & { productDownload: ProductDownload })[]
    },

    async redeemToken(token) {
      const row = await db.query.downloadTokens.findFirst({
        where: eq(downloadTokens.token, token),
        with: { productDownload: true },
      })
      if (!row) return null
      if (row.downloadCount >= row.maxDownloads) return null
      if (new Date() > row.expiresAt) return null

      await db
        .update(downloadTokens)
        .set({ downloadCount: row.downloadCount + 1 })
        .where(eq(downloadTokens.id, row.id))

      const dl = row.productDownload as ProductDownload
      return { url: dl.url, filename: dl.filename }
    },
  }
}
