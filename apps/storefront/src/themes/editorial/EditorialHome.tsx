import { useMeta } from '../../App.js'
import { trpc } from '../../trpc.js'
import { EditorialFeatured } from './sections/EditorialFeatured.js'
import { EditorialHero } from './sections/EditorialHero.js'
import { EditorialStory } from './sections/EditorialStory.js'

const SECTION_COMPONENTS: Record<
  string,
  React.ComponentType<{ config: Record<string, unknown> }>
> = {
  editorial_hero: EditorialHero as React.ComponentType<{ config: Record<string, unknown> }>,
  editorial_story: EditorialStory as React.ComponentType<{ config: Record<string, unknown> }>,
  editorial_featured: EditorialFeatured as React.ComponentType<{ config: Record<string, unknown> }>,
}

export function EditorialHome() {
  const meta = useMeta()
  const { data: sections = [] } = trpc.cms.themeSections.list.useQuery({ theme: 'editorial' })

  if (sections.length === 0) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#9ca3af',
            marginBottom: 24,
          }}
        >
          Editorial theme
        </p>
        <h1
          style={{
            fontSize: 'clamp(40px,6vw,80px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
          }}
        >
          {meta.storeName}
        </h1>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {sections.map((section) => {
        const Component = SECTION_COMPONENTS[section.sectionType]
        if (!Component) return null
        return <Component key={section.id} config={section.config as Record<string, unknown>} />
      })}
    </div>
  )
}
