import { useMeta } from '../../App.js'
import { trpc } from '../../trpc.js'
import { CategoryShowcase } from './sections/CategoryShowcase.js'
import { FeaturedProducts } from './sections/FeaturedProducts.js'
import { HeroSlider } from './sections/HeroSlider.js'
import { Newsletter } from './sections/Newsletter.js'

const SECTION_COMPONENTS: Record<
  string,
  React.ComponentType<{ config: Record<string, unknown> }>
> = {
  hero_slider: HeroSlider as React.ComponentType<{ config: Record<string, unknown> }>,
  featured_products: FeaturedProducts as React.ComponentType<{ config: Record<string, unknown> }>,
  category_showcase: CategoryShowcase as React.ComponentType<{ config: Record<string, unknown> }>,
  newsletter: Newsletter as React.ComponentType<{ config: Record<string, unknown> }>,
}

export function ClassicHome() {
  const meta = useMeta()
  const { data: sections = [] } = trpc.cms.themeSections.list.useQuery({ theme: 'classic' })

  if (sections.length === 0) {
    return (
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '80px 24px',
          textAlign: 'center',
          color: '#9ca3af',
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 16 }}>
          {meta.storeName}
        </h1>
        <p>Configure this theme in the backoffice → Theme Editor.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map((section) => {
        const Component = SECTION_COMPONENTS[section.sectionType]
        if (!Component) return null
        return <Component key={section.id} config={section.config as Record<string, unknown>} />
      })}
    </div>
  )
}
