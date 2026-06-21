import { Link, useLocation } from 'react-router-dom'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-24 text-center">
      <p
        className="text-8xl font-black tracking-tight mb-4"
        style={{ color: 'var(--primary)', opacity: 0.15 }}
      >
        404
      </p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2 -mt-10">Page not found</h1>
      <p className="text-gray-500 text-sm mb-1">
        The page{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{pathname}</code>{' '}
        doesn't exist.
      </p>
      <p className="text-gray-400 text-sm mb-8">It may have been moved or deleted.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Back to home
        </Link>
        <Link
          to="/products"
          className="px-6 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Browse products
        </Link>
      </div>
    </div>
  )
}
