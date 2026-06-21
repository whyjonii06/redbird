import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('Categories (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })

  beforeAll(async () => {
    await redbird.init()
  })

  beforeEach(async () => {
    await redbird.db.execute(
      sql`TRUNCATE TABLE product_categories, categories, product_variants, products RESTART IDENTITY CASCADE`,
    )
  })

  afterAll(async () => {
    await redbird.close()
  })

  it('creates a root category', async () => {
    const cat = await redbird.categories.create({ slug: 'coffee', name: 'Coffee' })
    expect(cat.slug).toBe('coffee')
    expect(cat.name).toBe('Coffee')
    expect(cat.parentId).toBeNull()
  })

  it('creates a subcategory with parentId', async () => {
    const parent = await redbird.categories.create({ slug: 'drinks', name: 'Drinks' })
    const child = await redbird.categories.create({
      slug: 'hot-drinks',
      name: 'Hot Drinks',
      parentId: parent.id,
    })
    expect(child.parentId).toBe(parent.id)
  })

  it('lists all categories', async () => {
    await redbird.categories.create({ slug: 'a', name: 'A' })
    await redbird.categories.create({ slug: 'b', name: 'B' })
    const list = await redbird.categories.list()
    expect(list).toHaveLength(2)
  })

  it('lists only root categories when parentId is null', async () => {
    const root = await redbird.categories.create({ slug: 'root', name: 'Root' })
    await redbird.categories.create({ slug: 'child', name: 'Child', parentId: root.id })
    const roots = await redbird.categories.list({ parentId: null })
    expect(roots).toHaveLength(1)
    expect(roots[0]?.slug).toBe('root')
  })

  it('lists children of a parent category', async () => {
    const parent = await redbird.categories.create({ slug: 'parent', name: 'Parent' })
    await redbird.categories.create({ slug: 'child-1', name: 'Child 1', parentId: parent.id })
    await redbird.categories.create({ slug: 'child-2', name: 'Child 2', parentId: parent.id })
    const children = await redbird.categories.list({ parentId: parent.id })
    expect(children).toHaveLength(2)
  })

  it('gets a category by slug', async () => {
    await redbird.categories.create({ slug: 'espresso', name: 'Espresso' })
    const found = await redbird.categories.getBySlug('espresso')
    expect(found?.name).toBe('Espresso')
  })

  it('returns null for unknown slug', async () => {
    const found = await redbird.categories.getBySlug('nope')
    expect(found).toBeNull()
  })

  it('updates a category', async () => {
    const cat = await redbird.categories.create({ slug: 'old', name: 'Old Name' })
    const updated = await redbird.categories.update(cat.id, { name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.slug).toBe('old')
  })

  it('deletes a category', async () => {
    const cat = await redbird.categories.create({ slug: 'to-delete', name: 'Delete Me' })
    await redbird.categories.delete(cat.id)
    const found = await redbird.categories.getById(cat.id)
    expect(found).toBeNull()
  })

  it('assigns and lists products in a category', async () => {
    const cat = await redbird.categories.create({ slug: 'beans', name: 'Coffee Beans' })
    const p1 = await redbird.catalog.createProduct(
      { slug: 'arabica', name: 'Arabica', status: 'active' },
      [{ sku: 'AR-1', name: '250g', priceAmount: 1200, priceCurrency: 'EUR' }],
    )
    const p2 = await redbird.catalog.createProduct(
      { slug: 'robusta', name: 'Robusta', status: 'active' },
      [{ sku: 'RO-1', name: '250g', priceAmount: 900, priceCurrency: 'EUR' }],
    )

    await redbird.categories.assignProduct(p1.id, cat.id)
    await redbird.categories.assignProduct(p2.id, cat.id)

    const products = await redbird.categories.listProducts(cat.id)
    expect(products).toHaveLength(2)
    const slugs = products.map((p) => p.slug)
    expect(slugs).toContain('arabica')
    expect(slugs).toContain('robusta')
    expect(products[0]?.variants).toBeDefined()
  })

  it('unassigns a product from a category', async () => {
    const cat = await redbird.categories.create({ slug: 'tea', name: 'Tea' })
    const product = await redbird.catalog.createProduct(
      { slug: 'green-tea', name: 'Green Tea', status: 'active' },
      [],
    )

    await redbird.categories.assignProduct(product.id, cat.id)
    await redbird.categories.unassignProduct(product.id, cat.id)

    const products = await redbird.categories.listProducts(cat.id)
    expect(products).toHaveLength(0)
  })

  it('assign is idempotent (no duplicate error)', async () => {
    const cat = await redbird.categories.create({ slug: 'idempotent', name: 'Idempotent' })
    const product = await redbird.catalog.createProduct(
      { slug: 'mug', name: 'Mug', status: 'active' },
      [],
    )

    await redbird.categories.assignProduct(product.id, cat.id)
    await expect(redbird.categories.assignProduct(product.id, cat.id)).resolves.not.toThrow()
  })

  it('deleting a category does not delete its products', async () => {
    const cat = await redbird.categories.create({ slug: 'doomed-cat', name: 'Doomed Cat' })
    const product = await redbird.catalog.createProduct(
      { slug: 'survivor', name: 'Survivor', status: 'active' },
      [],
    )
    await redbird.categories.assignProduct(product.id, cat.id)

    await redbird.categories.delete(cat.id)

    const found = await redbird.catalog.getProductBySlug('survivor')
    expect(found).not.toBeNull()
  })
})
