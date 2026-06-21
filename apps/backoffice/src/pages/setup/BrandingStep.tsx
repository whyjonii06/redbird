import { useRef, useState } from 'react'
import { BackBtn } from './ModulesStep.js'
import type { SetupData } from './types.js'

const COLORS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Slate', hex: '#475569' },
]

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onNext: () => void
  onBack: () => void
}

export function BrandingStep({ data, onChange, onNext, onBack }: Props) {
  const b = data.branding
  const set = (patch: Partial<SetupData['branding']>) => onChange({ branding: { ...b, ...patch } })

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') set({ logoUrl: result })
    }
    reader.readAsDataURL(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Branding</h2>
        <p className="text-sm text-gray-500 mt-1">
          Optional — you can fill this in later from the back office
        </p>
      </div>

      {/* Logo */}
      <div>
        <label className={lbl}>Logo</label>
        {b.logoUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={b.logoUrl}
              alt="logo preview"
              className="w-16 h-16 rounded-xl object-contain border border-gray-100 bg-gray-50 p-2 shrink-0"
            />
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 text-left"
              >
                Replace image
              </button>
              <button
                type="button"
                onClick={() => set({ logoUrl: '' })}
                className="text-sm text-gray-400 hover:text-gray-600 text-left"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
              dragging
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <svg
              aria-hidden="true"
              className="w-8 h-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-600">Click or drag to upload</p>
            <p className="text-xs text-gray-400">PNG, JPG, SVG, WebP</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Tagline */}
      <div>
        <label className={lbl}>Tagline</label>
        <input
          value={b.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
          placeholder="Quality products, fast delivery"
          className={inp}
        />
      </div>

      {/* Contact email */}
      <div>
        <label className={lbl}>Contact email</label>
        <input
          type="email"
          value={b.contactEmail}
          onChange={(e) => set({ contactEmail: e.target.value })}
          placeholder="hello@mystore.com"
          className={inp}
        />
      </div>

      {/* Brand color */}
      <div>
        <label className={lbl}>Brand color</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => set({ primaryColor: c.hex })}
              className={`w-9 h-9 rounded-full border-4 transition-all ${
                b.primaryColor === c.hex
                  ? 'border-gray-900 scale-110'
                  : 'border-transparent hover:scale-110'
              }`}
              style={{ background: c.hex }}
            />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <div className="w-9 h-9 rounded-full border-2 border-gray-200 overflow-hidden">
              <input
                type="color"
                value={b.primaryColor}
                onChange={(e) => set({ primaryColor: e.target.value })}
                className="w-12 h-12 -translate-x-1 -translate-y-1 cursor-pointer"
              />
            </div>
            <span className="text-xs text-gray-400 font-mono">{b.primaryColor}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
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

const lbl = 'block text-sm font-medium text-gray-700 mb-1.5'
const inp =
  'flex-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
