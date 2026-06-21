import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Product images (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE product_images, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  async function createProduct(slug = 'espresso') {
    return redbird.catalog.createProduct({ slug, name: slug, status: 'active' })
  }

  it('adds an image and retrieves it via list', async () => {
    const product = await createProduct()
    const img = await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg', alt: 'Cup' })
    expect(img.url).toBe('https://cdn.test/a.jpg')
    expect(img.alt).toBe('Cup')
    expect(img.position).toBe(0)
    const list = await redbird.images.list(product.id)
    expect(list).toHaveLength(1)
  })

  it('auto-increments position when not provided', async () => {
    const product = await createProduct()
    await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    await redbird.images.add(product.id, { url: 'https://cdn.test/b.jpg' })
    await redbird.images.add(product.id, { url: 'https://cdn.test/c.jpg' })
    const list = await redbird.images.list(product.id)
    expect(list.map((i) => i.position)).toEqual([0, 1, 2])
  })

  it('images are included in getProductBySlug', async () => {
    const product = await createProduct()
    await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    const full = await redbird.catalog.getProductBySlug('espresso')
    expect(full?.images).toHaveLength(1)
    expect(full?.images[0]?.url).toBe('https://cdn.test/a.jpg')
  })

  it('images are included in listProducts', async () => {
    const product = await createProduct()
    await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    const list = await redbird.catalog.listProducts()
    expect(list[0]?.images).toHaveLength(1)
  })

  it('updates alt text', async () => {
    const product = await createProduct()
    const img = await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg', alt: 'Old' })
    const updated = await redbird.images.update(img.id, { alt: 'New alt' })
    expect(updated.alt).toBe('New alt')
    expect(updated.url).toBe('https://cdn.test/a.jpg')
  })

  it('deletes an image', async () => {
    const product = await createProduct()
    const img = await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    await redbird.images.delete(img.id)
    expect(await redbird.images.list(product.id)).toHaveLength(0)
  })

  it('reorders images', async () => {
    const product = await createProduct()
    const a = await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    const b = await redbird.images.add(product.id, { url: 'https://cdn.test/b.jpg' })
    const c = await redbird.images.add(product.id, { url: 'https://cdn.test/c.jpg' })
    await redbird.images.reorder(product.id, [c.id, a.id, b.id])
    const list = await redbird.images.list(product.id)
    expect(list.map((i) => i.url)).toEqual([
      'https://cdn.test/c.jpg',
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ])
  })

  it('deleting a product cascades to its images', async () => {
    const product = await createProduct()
    await redbird.images.add(product.id, { url: 'https://cdn.test/a.jpg' })
    await redbird.catalog.deleteProduct(product.id)
    expect(await redbird.images.list(product.id)).toHaveLength(0)
  })

  it('can assign an image to a specific variant', async () => {
    await redbird.catalog.createProduct({ slug: 'shirt', name: 'Shirt', status: 'active' }, [
      { sku: 'SH-RED', name: 'Red', priceAmount: 2000, priceCurrency: 'EUR' },
    ])
    const full = await redbird.catalog.getProductBySlug('shirt')
    const variantId = full?.variants[0]?.id
    const img = await redbird.images.add(full?.id, {
      url: 'https://cdn.test/red.jpg',
      variantId,
    })
    expect(img.variantId).toBe(variantId)
  })
})
