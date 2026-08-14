import { Meilisearch } from 'meilisearch'
import type { SearchConfig } from '../config.js'
import type { Product, ProductVariant } from '../db/schema.js'

const INDEX = 'products'

export type ProductForIndex = Product & {
  variants: Pick<ProductVariant, 'sku'>[]
  brand: { name: string } | null
}

export type SearchService = {
  readonly enabled: boolean
  /** Create the index and configure searchable/filterable attributes. Safe to call repeatedly. */
  ensureIndex(): Promise<void>
  indexProduct(product: ProductForIndex): Promise<void>
  deleteProduct(productId: string): Promise<void>
  /** Bulk (re)index — used by the initial sync and the admin "Reindex" action. */
  indexAll(products: ProductForIndex[]): Promise<{ count: number }>
  /**
   * Ranked product ids matching the query, or null if search isn't configured/reachable —
   * callers should fall back to a plain DB query on null, not treat it as "no results".
   */
  search(
    query: string,
    opts?: { limit?: number; status?: Product['status'] },
  ): Promise<{ ids: string[]; estimatedTotalHits: number } | null>
}

function toDoc(p: ProductForIndex) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    sku: p.variants.map((v) => v.sku).join(' '),
    brandName: p.brand?.name ?? '',
    status: p.status,
    createdAt: p.createdAt.getTime(),
  }
}

export function createSearchService(config: SearchConfig | undefined): SearchService {
  if (!config) {
    return {
      enabled: false,
      async ensureIndex() {},
      async indexProduct() {},
      async deleteProduct() {},
      async indexAll() {
        return { count: 0 }
      },
      async search() {
        return null
      },
    }
  }

  const client = new Meilisearch(
    config.apiKey ? { host: config.host, apiKey: config.apiKey } : { host: config.host },
  )
  const index = client.index(INDEX)

  return {
    enabled: true,

    async ensureIndex() {
      try {
        await client.createIndex(INDEX, { primaryKey: 'id' })
      } catch {
        // Already exists — fine.
      }
      await index.updateSearchableAttributes(['name', 'sku', 'brandName', 'description'])
      await index.updateFilterableAttributes(['status'])
      await index.updateSortableAttributes(['createdAt'])
    },

    async indexProduct(product) {
      try {
        await index.addDocuments([toDoc(product)])
      } catch (err) {
        console.error('[search] failed to index product', product.id, err)
      }
    },

    async deleteProduct(productId) {
      try {
        await index.deleteDocument(productId)
      } catch (err) {
        console.error('[search] failed to delete product', productId, err)
      }
    },

    async indexAll(products) {
      await index.addDocuments(products.map(toDoc))
      return { count: products.length }
    },

    async search(query, opts = {}) {
      try {
        const result = await index.search(query, {
          limit: opts.limit ?? 20,
          ...(opts.status ? { filter: `status = ${opts.status}` } : {}),
        })
        return {
          ids: result.hits.map((h) => h.id as string),
          estimatedTotalHits: result.estimatedTotalHits ?? result.hits.length,
        }
      } catch (err) {
        console.error('[search] query failed, caller should fall back to DB search', err)
        return null
      }
    },
  }
}
