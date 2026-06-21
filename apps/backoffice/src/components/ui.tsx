import type { ReactNode } from 'react'

// ── Input ────────────────────────────────────────────────────────────────────
export const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-100 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

// ── Button system ─────────────────────────────────────────────────────────────
// Gray scale is remapped in dark theme:
//   gray-100=#101010 gray-200=#1e1e1e gray-300=#2a2a2a gray-700=#cccccc gray-900=#f5f5f5
// Indigo is remapped to brand red (#E8302A).
// Red/blue/green/orange are standard Tailwind (not remapped).

const _b =
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap'

// Default size (px-4 py-2 text-sm)
export const btnPrimary = `${_b} px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white`
export const btnSecondary = `${_b} px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300`
export const btnDanger = `${_b} px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white`
export const btnDangerOutline = `${_b} px-4 py-2 text-sm border border-red-500 text-red-500 hover:bg-red-600 hover:text-white`
export const btnSuccess = `${_b} px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white`
export const btnBlue = `${_b} px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white`
export const btnOrange = `${_b} px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white`
export const btnOrangeOutline = `${_b} px-4 py-2 text-sm border border-orange-500 text-orange-500 hover:bg-orange-600 hover:text-white`
export const btnGhost = `${_b} px-4 py-2 text-sm text-gray-700 hover:bg-gray-200`

// Small size (px-3 py-1.5 text-xs)
export const btnSmPrimary = `${_b} px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white`
export const btnSmSecondary = `${_b} px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300`
export const btnSmDanger = `${_b} px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white`
export const btnSmSuccess = `${_b} px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white`

// Inline link-style (table row actions — no background, text-only)
export const btnLink = 'text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors'
export const btnLinkDanger = 'text-xs font-medium text-red-500 hover:text-red-700 transition-colors'
export const btnLinkMuted =
  'text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors'

// ── Layout components ─────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function FormCard({
  children,
  className = '',
}: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-100 border border-gray-200 rounded-lg p-6 space-y-4 ${className}`}>
      {children}
    </div>
  )
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: { icon?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg py-16 text-center bg-gray-100">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="p-8 space-y-6">{children}</div>
}

// ── Error helpers ─────────────────────────────────────────────────────────────

/** Converts a tRPC/Zod error to a human-readable string. */
export function parseApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const lines = (parsed as { message?: string; path?: string[] }[])
        .map((e) => {
          const field = e.path?.filter(Boolean).join('.')
          const msg = e.message ?? ''
          return field ? `${field}: ${msg}` : msg
        })
        .filter(Boolean)
      if (lines.length) return lines.join('\n')
    }
  } catch {}
  return raw
}

export function ErrorAlert({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <svg
        aria-hidden="true"
        className="shrink-0 mt-0.5 w-4 h-4 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <p className="whitespace-pre-line">{message}</p>
    </div>
  )
}
