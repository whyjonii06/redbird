import { and, asc, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type ProductImage, productImages } from '../db/schema.js'

export type AddImageInput = {
  url: string
  alt?: string | undefined
  variantId?: string | undefined
  position?: number | undefined
}

export type ImageService = {
  /** Add an image to a product. Position defaults to end of list. */
  add(productId: string, input: AddImageInput): Promise<ProductImage>
  /** List images for a product, sorted by position then createdAt. */
  list(productId: string): Promise<ProductImage[]>
  /** Update alt text or position. */
  update(
    imageId: string,
    patch: { alt?: string | undefined; position?: number | undefined },
  ): Promise<ProductImage>
  /** Remove an image. */
  delete(imageId: string): Promise<void>
  /**
   * Set the display order for a product's images by providing image IDs in desired order.
   * Assigns positions 0, 1, 2, ... respectively.
   */
  reorder(productId: string, imageIds: string[]): Promise<void>
}

export function createImageService(db: DbClient): ImageService {
  return {
    async add(productId, input) {
      let position = input.position
      if (position === undefined) {
        const existing = await db.query.productImages.findMany({
          where: eq(productImages.productId, productId),
        })
        position = existing.length
      }
      const [image] = await db
        .insert(productImages)
        .values({
          productId,
          variantId: input.variantId ?? null,
          url: input.url,
          alt: input.alt ?? null,
          position,
        })
        .returning()
      if (!image) throw new Error('Failed to add image')
      return image
    },

    async list(productId) {
      return db.query.productImages.findMany({
        where: eq(productImages.productId, productId),
        orderBy: [asc(productImages.position), asc(productImages.createdAt)],
      })
    },

    async update(imageId, patch) {
      const setValues: Record<string, unknown> = { alt: patch.alt ?? null, updatedAt: new Date() }
      if (patch.position !== undefined) setValues.position = patch.position
      const [image] = await db
        .update(productImages)
        .set(setValues)
        .where(eq(productImages.id, imageId))
        .returning()
      if (!image) throw new Error(`Image ${imageId} not found`)
      return image
    },

    async delete(imageId) {
      const deleted = await db
        .delete(productImages)
        .where(eq(productImages.id, imageId))
        .returning()
      if (deleted.length === 0) throw new Error(`Image ${imageId} not found`)
    },

    async reorder(productId, imageIds) {
      for (let i = 0; i < imageIds.length; i++) {
        const id = imageIds[i]!
        await db
          .update(productImages)
          .set({ position: i, updatedAt: new Date() })
          .where(and(eq(productImages.id, id), eq(productImages.productId, productId)))
      }
    },
  }
}
