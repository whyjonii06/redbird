import { useMeta } from '../App.js'
import { ClassicHome } from '../themes/classic/ClassicHome.js'
import { EditorialHome } from '../themes/editorial/EditorialHome.js'
import { LookbookHome } from '../themes/lookbook/LookbookHome.js'

export function HomePage() {
  const meta = useMeta()

  if (meta.theme === 'editorial') return <EditorialHome />
  if (meta.theme === 'lookbook') return <LookbookHome />
  return <ClassicHome />
}
