import { useMeta } from '../../App.js'
import { trpc } from '../../trpc.js'
import { LookbookCollection } from './sections/LookbookCollection.js'
import { LookbookGrid } from './sections/LookbookGrid.js'
import { LookbookHero } from './sections/LookbookHero.js'

const SECTION_COMPONENTS: Record<
  string,
  React.ComponentType<{ config: Record<string, unknown> }>
> = {
  lookbook_hero: LookbookHero as React.ComponentType<{ config: Record<string, unknown> }>,
  lookbook_grid: LookbookGrid as React.ComponentType<{ config: Record<string, unknown> }>,
  lookbook_collection: LookbookCollection as React.ComponentType<{
    config: Record<string, unknown>
  }>,
}

export function LookbookHome() {
  const meta = useMeta()
  const { data: sections = [] } = trpc.cms.themeSections.list.useQuery({ theme: 'lookbook' })

  if (sections.length === 0) {
    return (
      <div
        style={{
          height: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(48px,8vw,120px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            textTransform: 'uppercase',
          }}
        >
          {meta.storeName}
        </h1>
      </div>
    )
  }

  return (
    <div style={{ background: '#000' }}>
      {sections.map((section) => {
        const Component = SECTION_COMPONENTS[section.sectionType]
        if (!Component) return null
        return <Component key={section.id} config={section.config as Record<string, unknown>} />
      })}
    </div>
  )
}
