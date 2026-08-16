import { useMeta } from '../App.js'
import { ClassicHome } from '../themes/classic/ClassicHome.js'
import { EditorialHome } from '../themes/editorial/EditorialHome.js'
import { LookbookHome } from '../themes/lookbook/LookbookHome.js'
import { useSeoMeta } from '../useSeoMeta.js'

export function HomePage() {
  const meta = useMeta()

  useSeoMeta({
    title: meta.branding.tagline ? `${meta.storeName} — ${meta.branding.tagline}` : meta.storeName,
    description: meta.branding.tagline,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: meta.storeName,
      ...(meta.branding.logoUrl ? { logo: meta.branding.logoUrl } : {}),
    },
  })

  if (meta.theme === 'editorial') return <EditorialHome />
  if (meta.theme === 'lookbook') return <LookbookHome />
  return <ClassicHome />
}
