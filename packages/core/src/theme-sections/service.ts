import { and, asc, eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { type NewThemeSection, type ThemeSection, themeSections } from '../db/schema.js'

export type ThemeSectionService = {
  listByTheme(theme: string): Promise<ThemeSection[]>
  upsert(input: Omit<NewThemeSection, 'createdAt' | 'updatedAt'>): Promise<ThemeSection>
  updatePosition(id: string, position: number): Promise<void>
  setActive(id: string, isActive: boolean): Promise<void>
  delete(id: string): Promise<void>
  seedDefaults(theme: string): Promise<void>
}

const DEFAULTS: Record<string, Array<Omit<NewThemeSection, 'id' | 'createdAt' | 'updatedAt'>>> = {
  classic: [
    {
      theme: 'classic',
      sectionType: 'hero_slider',
      position: 0,
      isActive: true,
      config: {
        autoplay: true,
        interval: 5000,
        slides: [
          {
            id: '1',
            image: 'https://images.unsplash.com/photo-1554668048-5055c5654bbc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600',
            title: 'New Collection',
            subtitle: 'Discover our latest arrivals',
            ctaLabel: 'Shop now',
            ctaUrl: '/products',
          },
          {
            id: '2',
            image: 'https://images.unsplash.com/photo-1776193550326-fb87ffba0442?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600',
            title: 'Summer Sale',
            subtitle: 'Up to 30% off selected items',
            ctaLabel: 'See deals',
            ctaUrl: '/products',
          },
        ],
      },
    },
    {
      theme: 'classic',
      sectionType: 'featured_products',
      position: 1,
      isActive: true,
      config: { title: 'New arrivals', columns: 4 },
    },
    {
      theme: 'classic',
      sectionType: 'category_showcase',
      position: 2,
      isActive: true,
      config: { title: 'Shop by category' },
    },
    {
      theme: 'classic',
      sectionType: 'newsletter',
      position: 3,
      isActive: true,
      config: {
        title: 'Stay in the loop',
        subtitle: 'Get new arrivals and exclusive offers straight to your inbox.',
        placeholder: 'your@email.com',
        buttonLabel: 'Subscribe',
      },
    },
  ],
  editorial: [
    {
      theme: 'editorial',
      sectionType: 'editorial_hero',
      position: 0,
      isActive: true,
      config: {
        image: 'https://images.unsplash.com/photo-1777507743485-d4a69842a34e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600',
        eyebrow: 'New season',
        title: 'Crafted for those\nwho notice details',
        body: 'Each piece is designed with intention. Explore the new collection.',
        ctaLabel: 'Explore the collection',
        ctaUrl: '/products',
        imagePosition: 'right',
      },
    },
    {
      theme: 'editorial',
      sectionType: 'editorial_story',
      position: 1,
      isActive: true,
      config: {
        image: 'https://images.unsplash.com/photo-1778003586075-0d361afc71a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600',
        eyebrow: 'Behind the craft',
        title: 'Made to last a lifetime',
        body: 'We source materials from family-run workshops that have been perfecting their craft for generations.',
        ctaLabel: 'Our story',
        ctaUrl: '/pages/about',
        imagePosition: 'left',
        productId: null,
      },
    },
    {
      theme: 'editorial',
      sectionType: 'editorial_featured',
      position: 2,
      isActive: true,
      config: {
        productId: null,
        quote: 'The kind of object you\'ll keep for twenty years and still love.',
        quoteAuthor: 'Design Review',
      },
    },
  ],
  lookbook: [
    {
      theme: 'lookbook',
      sectionType: 'lookbook_hero',
      position: 0,
      isActive: true,
      config: {
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1778402056038-a437ba87db74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600',
        title: 'The Edit',
        subtitle: 'Spring / Summer 2026',
        ctaLabel: 'Shop the look',
        ctaUrl: '/products',
        overlayOpacity: 0.4,
      },
    },
    {
      theme: 'lookbook',
      sectionType: 'lookbook_grid',
      position: 1,
      isActive: true,
      config: {
        items: [
          { id: '1', image: 'https://images.unsplash.com/photo-1778532747969-0bbb4c9b5151?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200', productId: null, label: 'Editorial', size: 'large' },
          { id: '2', image: 'https://images.unsplash.com/photo-1780182309635-990aea44c255?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800', productId: null, label: 'New In', size: 'small' },
          { id: '3', image: 'https://images.unsplash.com/photo-1780653503232-8d0bb70550bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800', productId: null, label: 'Basics', size: 'small' },
          { id: '4', image: 'https://images.unsplash.com/photo-1781026816764-4bc19cad5529?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200', productId: null, label: 'Sale', size: 'large' },
        ],
      },
    },
    {
      theme: 'lookbook',
      sectionType: 'lookbook_collection',
      position: 2,
      isActive: true,
      config: { title: 'Featured pieces' },
    },
  ],
}

export function createThemeSectionService(db: DbClient): ThemeSectionService {
  return {
    async listByTheme(theme) {
      return db.query.themeSections.findMany({
        where: and(eq(themeSections.theme, theme), eq(themeSections.isActive, true)),
        orderBy: [asc(themeSections.position)],
      })
    },

    async upsert(input) {
      if (input.id) {
        const [row] = await db
          .update(themeSections)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(themeSections.id, input.id))
          .returning()
        if (!row) throw new Error(`ThemeSection ${input.id} not found`)
        return row
      }
      const [row] = await db.insert(themeSections).values(input).returning()
      if (!row) throw new Error('Failed to create ThemeSection')
      return row
    },

    async updatePosition(id, position) {
      await db.update(themeSections).set({ position, updatedAt: new Date() }).where(eq(themeSections.id, id))
    },

    async setActive(id, isActive) {
      await db.update(themeSections).set({ isActive, updatedAt: new Date() }).where(eq(themeSections.id, id))
    },

    async delete(id) {
      await db.delete(themeSections).where(eq(themeSections.id, id))
    },

    async seedDefaults(theme) {
      const existing = await db.query.themeSections.findMany({
        where: eq(themeSections.theme, theme),
      })
      if (existing.length > 0) return
      const defaults = DEFAULTS[theme]
      if (!defaults) return
      await db.insert(themeSections).values(defaults)
    },
  }
}
