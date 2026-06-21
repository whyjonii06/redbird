import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import {
  type AttributeValue,
  type ProductAttribute,
  attributeValues,
  productAttributes,
  productVariants,
  variantAttributeValues,
} from '../db/schema.js'

export type AttributeWithValues = ProductAttribute & { values: AttributeValue[] }

export type AttributeService = {
  /** List all attributes (with values) for a product. */
  listAttributes(productId: string): Promise<AttributeWithValues[]>
  /** Add an attribute (e.g. "Color") to a product. */
  addAttribute(productId: string, name: string): Promise<AttributeWithValues>
  /** Add a value to an attribute (e.g. "Red"). */
  addValue(attributeId: string, value: string): Promise<AttributeValue>
  /** Remove an attribute (and all its values + variant links). */
  removeAttribute(id: string): Promise<void>
  /** Remove a specific attribute value. */
  removeValue(id: string): Promise<void>
  /**
   * Generate all missing variant combinations for a product based on its attributes.
   * Accepts a base variant config (price, currency) for newly generated variants.
   */
  generateCombinations(
    productId: string,
    base: {
      priceAmount: number
      priceCurrency: string
      inventoryQuantity?: number
    },
  ): Promise<{ created: number; skipped: number }>
  /** Get the attribute values assigned to a specific variant. */
  getVariantAttributes(variantId: string): Promise<Array<{ attribute: string; value: string }>>
}

export function createAttributeService(db: DbClient): AttributeService {
  return {
    async listAttributes(productId) {
      const attrs = await db.query.productAttributes.findMany({
        where: eq(productAttributes.productId, productId),
        with: { values: true },
        orderBy: (a, { asc }) => [asc(a.position)],
      })
      return attrs
    },

    async addAttribute(productId, name) {
      const existing = await db.query.productAttributes.findMany({
        where: eq(productAttributes.productId, productId),
        columns: { id: true },
      })
      const [attr] = await db
        .insert(productAttributes)
        .values({
          productId,
          name,
          position: existing.length,
        })
        .returning()
      if (!attr) throw new Error('Failed to create attribute')
      return { ...attr, values: [] }
    },

    async addValue(attributeId, value) {
      const existing = await db.query.attributeValues.findMany({
        where: eq(attributeValues.attributeId, attributeId),
        columns: { id: true },
      })
      const [val] = await db
        .insert(attributeValues)
        .values({
          attributeId,
          value,
          position: existing.length,
        })
        .returning()
      if (!val) throw new Error('Failed to create attribute value')
      return val
    },

    async removeAttribute(id) {
      await db.delete(productAttributes).where(eq(productAttributes.id, id))
    },

    async removeValue(id) {
      await db.delete(attributeValues).where(eq(attributeValues.id, id))
    },

    async generateCombinations(productId, base) {
      const attrs = await db.query.productAttributes.findMany({
        where: eq(productAttributes.productId, productId),
        with: { values: true },
        orderBy: (a, { asc }) => [asc(a.position)],
      })
      if (attrs.length === 0 || attrs.some((a) => a.values.length === 0)) {
        return { created: 0, skipped: 0 }
      }

      // Cartesian product of all attribute values
      const combos: AttributeValue[][] = attrs.reduce<AttributeValue[][]>((acc, attr) => {
        if (acc.length === 0) return attr.values.map((v) => [v])
        return acc.flatMap((combo) => attr.values.map((v) => [...combo, v]))
      }, [])

      // Get existing variants with their attribute assignments
      const existingVariants = await db.query.productVariants.findMany({
        where: eq(productVariants.productId, productId),
        with: { attributeValues: { with: { attributeValue: true } } },
      })

      const existingSigs = new Set(
        existingVariants.map((v) =>
          v.attributeValues
            .map((av) => av.attributeValueId)
            .sort()
            .join(','),
        ),
      )

      let created = 0
      let skipped = 0

      for (const combo of combos) {
        const sig = combo
          .map((v) => v.id)
          .sort()
          .join(',')
        if (existingSigs.has(sig)) {
          skipped++
          continue
        }

        const name = combo.map((v) => v.value).join(' / ')
        const sku = `${productId.slice(0, 8)}-${combo.map((v) => v.value.toLowerCase().replace(/\s+/g, '-')).join('-')}`

        const [variant] = await db
          .insert(productVariants)
          .values({
            productId,
            sku,
            name,
            priceAmount: base.priceAmount,
            priceCurrency: base.priceCurrency,
            inventoryQuantity: base.inventoryQuantity ?? 0,
            attributes: Object.fromEntries(
              combo.map((v) => {
                const attr = attrs.find((a) => a.values.some((av) => av.id === v.id))
                return [attr?.name ?? 'unknown', v.value]
              }),
            ),
          })
          .returning()

        if (!variant) continue

        // Link variant to attribute values
        for (const val of combo) {
          await db.insert(variantAttributeValues).values({
            variantId: variant.id,
            attributeValueId: val.id,
          })
        }
        created++
      }

      return { created, skipped }
    },

    async getVariantAttributes(variantId) {
      const rows = await db.query.variantAttributeValues.findMany({
        where: eq(variantAttributeValues.variantId, variantId),
        with: {
          attributeValue: {
            with: { attribute: true },
          },
        },
      })
      return rows.map((r) => ({
        attribute: r.attributeValue.attribute.name,
        value: r.attributeValue.value,
      }))
    },
  }
}
