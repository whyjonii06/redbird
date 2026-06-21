import { createRedbird } from '@redbirdshop/core'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('i18n / product translations (integration)', () => {
  const redbird = createRedbird({ defaultCurrency: 'EUR' })
  let productId: string

  beforeAll(async () => {
    await redbird.init()
    const p = await redbird.catalog.createProduct({
      name: 'Base Product',
      slug: 'base-product',
      price: 1000,
      currency: 'EUR',
    })
    productId = p.id
  })

  beforeEach(async () => {
    await redbird.db.execute(sql`TRUNCATE TABLE product_translations RESTART IDENTITY CASCADE`)
  })

  afterAll(async () => {
    await redbird.close()
  })

  it('upserts a translation for a locale', async () => {
    const t = await redbird.i18n.upsert(productId, 'fr', {
      name: 'Produit de base',
      description: 'Une description',
    })
    expect(t.locale).toBe('fr')
    expect(t.name).toBe('Produit de base')
    expect(t.description).toBe('Une description')
    expect(t.productId).toBe(productId)
  })

  it('normalises locale to lowercase', async () => {
    const t = await redbird.i18n.upsert(productId, 'FR', { name: 'Produit' })
    expect(t.locale).toBe('fr')
  })

  it('updates an existing translation on conflict', async () => {
    await redbird.i18n.upsert(productId, 'de', { name: 'Produkt', description: 'Alt' })
    const updated = await redbird.i18n.upsert(productId, 'de', {
      name: 'Neues Produkt',
      description: 'Neu',
    })
    expect(updated.name).toBe('Neues Produkt')
    expect(updated.description).toBe('Neu')
  })

  it('gets a single translation', async () => {
    await redbird.i18n.upsert(productId, 'es', { name: 'Producto base' })
    const t = await redbird.i18n.get(productId, 'es')
    expect(t).not.toBeNull()
    expect(t?.name).toBe('Producto base')
  })

  it('returns null for missing locale', async () => {
    const t = await redbird.i18n.get(productId, 'ja')
    expect(t).toBeNull()
  })

  it('lists all translations for a product', async () => {
    await redbird.i18n.upsert(productId, 'fr', { name: 'FR' })
    await redbird.i18n.upsert(productId, 'de', { name: 'DE' })
    await redbird.i18n.upsert(productId, 'es', { name: 'ES' })
    const list = await redbird.i18n.list(productId)
    expect(list).toHaveLength(3)
    expect(list.map((t) => t.locale)).toEqual(['de', 'es', 'fr']) // ordered by locale asc
  })

  it('deletes a translation', async () => {
    await redbird.i18n.upsert(productId, 'it', { name: 'Prodotto' })
    await redbird.i18n.delete(productId, 'it')
    const t = await redbird.i18n.get(productId, 'it')
    expect(t).toBeNull()
  })

  describe('translate()', () => {
    it('returns product with translated name and description', async () => {
      await redbird.i18n.upsert(productId, 'fr', { name: 'Produit FR', description: 'Desc FR' })
      const product = await redbird.catalog.getProductById(productId)
      const translated = redbird.i18n.translate(product!, 'fr')
      expect(translated.name).toBe('Produit FR')
      expect(translated.description).toBe('Desc FR')
    })

    it('falls back to base product when locale not found', async () => {
      const product = await redbird.catalog.getProductById(productId)
      const translated = redbird.i18n.translate(product!, 'zh')
      expect(translated.name).toBe(product?.name)
    })

    it('uses fallback locale when primary not found', async () => {
      await redbird.i18n.upsert(productId, 'en', { name: 'Product EN' })
      const product = await redbird.catalog.getProductById(productId)
      const translated = redbird.i18n.translate(product!, 'zh', 'en')
      expect(translated.name).toBe('Product EN')
    })

    it('prefers primary locale over fallback', async () => {
      await redbird.i18n.upsert(productId, 'fr', { name: 'Produit FR' })
      await redbird.i18n.upsert(productId, 'en', { name: 'Product EN' })
      const product = await redbird.catalog.getProductById(productId)
      const translated = redbird.i18n.translate(product!, 'fr', 'en')
      expect(translated.name).toBe('Produit FR')
    })

    it('falls back to base description when translation has none', async () => {
      await redbird.i18n.upsert(productId, 'nl', { name: 'Product NL' })
      const product = await redbird.catalog.getProductById(productId)
      const translated = redbird.i18n.translate(product!, 'nl')
      expect(translated.name).toBe('Product NL')
      expect(translated.description).toBe(product?.description)
    })
  })
})
