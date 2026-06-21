import { BackBtn } from './ModulesStep.js'
import type { SetupData } from './types.js'

type Theme = SetupData['theme']

const THEMES: Array<{ id: Theme; name: string; desc: string; preview: React.ReactNode }> = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Traditional grid layout — familiar and conversion-optimised',
    preview: <ClassicPreview />,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    desc: 'Content-first, big typography — great for lifestyle brands',
    preview: <EditorialPreview />,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Ultra-clean and fast — lets your products do the talking',
    preview: <MinimalPreview />,
  },
]

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onNext: () => void
  onBack: () => void
}

export function ThemeStep({ data, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Storefront theme</h2>
        <p className="text-sm text-gray-500 mt-1">Choose how your shop looks to customers</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {THEMES.map((t) => {
          const active = data.theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ theme: t.id })}
              className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                active
                  ? 'border-indigo-600 shadow-md shadow-indigo-100'
                  : 'border-gray-100 hover:border-indigo-200'
              }`}
            >
              {/* Preview */}
              <div className="bg-gray-50 border-b border-gray-100 h-36 flex items-center justify-center overflow-hidden">
                {t.preview}
              </div>
              {/* Label */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  {active && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <BackBtn onClick={onBack} />
        <button
          type="button"
          onClick={onNext}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ─── Preview illustrations ───────────────────────────────────────────────────

function ClassicPreview() {
  return (
    <div className="w-full px-3 py-2 scale-90">
      {/* Nav */}
      <div className="flex items-center gap-1 mb-2">
        <div className="w-8 h-2 bg-gray-800 rounded" />
        <div className="flex-1" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-6 h-1.5 bg-gray-300 rounded" />
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg border border-gray-100 overflow-hidden">
            <div className="h-8 bg-gradient-to-br from-gray-100 to-gray-200" />
            <div className="p-1 space-y-1">
              <div className="h-1.5 bg-gray-800 rounded w-3/4" />
              <div className="h-1.5 bg-indigo-400 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditorialPreview() {
  return (
    <div className="w-full px-3 py-2 scale-90">
      {/* Hero */}
      <div className="bg-gray-900 rounded-xl h-14 mb-2 flex items-end p-2">
        <div>
          <div className="h-2.5 bg-gray-100 rounded w-20 mb-1" />
          <div className="h-1.5 bg-gray-400 rounded w-14" />
        </div>
      </div>
      {/* 2-col */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-800 rounded w-full" />
          <div className="h-1.5 bg-gray-300 rounded w-4/5" />
          <div className="h-1.5 bg-gray-300 rounded w-3/5" />
          <div className="h-1.5 bg-indigo-500 rounded w-1/2 mt-2" />
        </div>
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg" />
      </div>
    </div>
  )
}

function MinimalPreview() {
  return (
    <div className="w-full px-4 py-3 scale-90 text-center">
      <div className="h-2 bg-gray-900 rounded w-12 mx-auto mb-4" />
      <div className="space-y-1.5 mb-3">
        <div className="h-1.5 bg-gray-200 rounded w-4/5 mx-auto" />
        <div className="h-1.5 bg-gray-200 rounded w-3/5 mx-auto" />
      </div>
      {/* Products */}
      <div className="flex gap-2 justify-center">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="w-16 bg-gray-100 border border-gray-100 rounded-xl overflow-hidden"
          >
            <div className="h-10 bg-gray-50" />
            <div className="p-1.5">
              <div className="h-1.5 bg-gray-700 rounded w-3/4 mb-1" />
              <div className="h-1.5 bg-gray-300 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
