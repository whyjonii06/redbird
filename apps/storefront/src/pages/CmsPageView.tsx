import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../App.js'
import { RedirectOrNotFound } from '../components/RedirectOrNotFound.js'
import { useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'
import { useSeoMeta } from '../useSeoMeta.js'

export function CmsPageView() {
  const { slug } = useParams<{ slug: string }>()
  const meta = useMeta()
  const { locale } = useI18n()
  const {
    data: page,
    isLoading,
    error,
  } = trpc.cms.bySlug.useQuery({ slug: slug!, locale }, { enabled: Boolean(slug) })

  useSeoMeta(
    page
      ? {
          title: `${page.title} — ${meta.storeName}`,
          description: page.excerpt ?? page.content.slice(0, 160),
          ogType: 'article',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.title,
            ...(page.excerpt ? { description: page.excerpt } : {}),
          },
        }
      : undefined,
  )

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="h-8 bg-gray-100 rounded w-64 animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-100 rounded animate-pulse"
              style={{ width: `${80 + Math.random() * 20}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <RedirectOrNotFound
        fallback={
          <div className="max-w-3xl mx-auto px-4 py-24 text-center">
            <p className="text-gray-400 text-lg">Page not found.</p>
            <Link to="/" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
              Back to home →
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{page.title}</h1>
      {/* CMS content is authored as plain text in a textarea — render it as
          text (preserving line breaks) rather than HTML to avoid stored XSS. */}
      <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
        {page.content}
      </div>
    </div>
  )
}
