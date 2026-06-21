import { useEffect, useState } from 'react'
import { trpc } from '../trpc.js'

type Config = Record<string, unknown>

const THEME_LABELS: Record<string, string> = {
  classic: 'Classic',
  editorial: 'Editorial',
  lookbook: 'Lookbook',
  minimal: 'Minimal',
}

const SECTION_LABELS: Record<string, string> = {
  hero_slider: 'Hero Slider',
  featured_products: 'Featured Products',
  category_showcase: 'Category Showcase',
  newsletter: 'Newsletter',
  editorial_hero: 'Editorial Hero',
  editorial_story: 'Story Section',
  editorial_featured: 'Featured Product',
  lookbook_hero: 'Lookbook Hero',
  lookbook_grid: 'Lookbook Grid',
  lookbook_collection: 'Collection Strip',
}

// ── Unsplash picker ───────────────────────────────────────────────────────────

type UnsplashPhoto = {
  id: string
  urls: { thumb: string; regular: string; small: string }
  alt_description: string | null
  user: { name: string; links: { html: string } }
  links: { download_location: string }
}

function UnsplashPicker({
  accessKey,
  defaultQuery,
  onSelect,
  onClose,
}: {
  accessKey: string
  defaultQuery?: string
  onSelect: (url: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [results, setResults] = useState<UnsplashPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=16&orientation=landscape&client_id=${accessKey}`,
      )
      const data = (await res.json()) as { results: UnsplashPhoto[] }
      setResults(data.results ?? [])
      setSearched(true)
    } catch {
      // network error — silent
    } finally {
      setLoading(false)
    }
  }

  async function pick(photo: UnsplashPhoto) {
    // Trigger download as required by Unsplash API guidelines
    fetch(`${photo.links.download_location}&client_id=${accessKey}`).catch(() => {})
    onSelect(photo.urls.regular)
  }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 100,
        top: '100%',
        left: 0,
        right: 0,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        padding: 16,
        marginTop: 4,
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Search photos… (fashion, nature, architecture…)"
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            fontSize: 13,
            color: '#111',
          }}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {loading ? '…' : 'Search'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 12px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          ✕
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {results.map((photo) => (
              <div
                key={photo.id}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => void pick(photo)}
              >
                <img
                  src={photo.urls.small}
                  alt={photo.alt_description ?? ''}
                  style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    objectFit: 'cover',
                    borderRadius: 6,
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0)',
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 4,
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.35)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)'
                  }}
                >
                  <span
                    style={{ fontSize: 10, color: '#fff', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLSpanElement).style.opacity = '1'
                    }}
                  >
                    {photo.user.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 8 }}>
            Photos by{' '}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#6b7280' }}
            >
              Unsplash
            </a>
          </p>
        </>
      )}

      {searched && results.length === 0 && !loading && (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          No results for "{query}"
        </p>
      )}

      {!searched && !loading && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          Type a keyword and press Enter or click Search
        </p>
      )}
    </div>
  )
}

// ── Shared field components ───────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{hint}</p>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 13,
  color: '#111',
  background: '#fff',
  boxSizing: 'border-box',
}

function TextInput({
  value,
  onChange,
  placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  )
}

function LinkInput({
  value,
  onChange,
  placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '/products'}
      style={inputStyle}
    />
  )
}

function ImageInput({
  value,
  onChange,
  unsplashKey,
  defaultQuery,
}: {
  value: string
  onChange: (v: string) => void
  unsplashKey: string
  defaultQuery?: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          style={{ ...inputStyle, flex: 1 }}
        />
        {unsplashKey && (
          <button
            type="button"
            onClick={() => setPickerOpen((p) => !p)}
            style={{
              padding: '0 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: pickerOpen ? '#111' : '#f9fafb',
              color: pickerOpen ? '#fff' : '#374151',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>🖼</span> Unsplash
          </button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt=""
          style={{
            marginTop: 6,
            width: '100%',
            maxHeight: 80,
            objectFit: 'cover',
            borderRadius: 6,
            display: 'block',
          }}
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      {pickerOpen && unsplashKey && (
        <UnsplashPicker
          accessKey={unsplashKey}
          {...(defaultQuery ? { defaultQuery } : {})}
          onSelect={(url) => {
            onChange(url)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ...inputStyle, width: 120 }}
    />
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? '#10b981' : '#d1d5db',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, width: 'auto' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '16px',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        background: '#fff',
        border: '1px dashed #9ca3af',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        cursor: 'pointer',
      }}
    >
      + {label}
    </button>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 8px',
        background: '#fee2e2',
        border: 'none',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: '#991b1b',
        cursor: 'pointer',
      }}
    >
      Remove
    </button>
  )
}

// ── Section-specific forms ────────────────────────────────────────────────────

type Slide = {
  id: string
  image: string
  title: string
  subtitle: string
  ctaLabel: string
  ctaUrl: string
}

function HeroSliderForm({
  config,
  onChange,
  uk,
}: { config: Config; onChange: (c: Config) => void; uk: string }) {
  const slides = (config.slides as Slide[] | undefined) ?? []
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  const setSlide = (i: number, key: keyof Slide, val: string) => {
    const next = slides.map((s, idx) => (idx === i ? { ...s, [key]: val } : s))
    set('slides', next)
  }
  const addSlide = () =>
    set('slides', [
      ...slides,
      {
        id: String(Date.now()),
        image: '',
        title: '',
        subtitle: '',
        ctaLabel: 'Shop now',
        ctaUrl: '/products',
      },
    ])
  const removeSlide = (i: number) =>
    set(
      'slides',
      slides.filter((_, idx) => idx !== i),
    )

  return (
    <div>
      <Field label="Autoplay">
        <Toggle
          checked={!!config.autoplay}
          onChange={(v) => set('autoplay', v)}
          label="Activate autoplay"
        />
      </Field>
      {!!config.autoplay && (
        <Field label="Interval (ms)" hint="Duration between slides">
          <NumberInput
            value={(config.interval as number) ?? 5000}
            onChange={(v) => set('interval', v)}
            min={1000}
            max={30000}
          />
        </Field>
      )}
      <Field label="Slides">
        {slides.map((slide, i) => (
          <SectionCard key={i}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Slide {i + 1}</span>
              <RemoveBtn onClick={() => removeSlide(i)} />
            </div>
            <Field label="Background image">
              <ImageInput
                value={slide.image}
                onChange={(v) => setSlide(i, 'image', v)}
                unsplashKey={uk}
                defaultQuery="hero fashion banner"
              />
            </Field>
            <Field label="Title">
              <TextInput
                value={slide.title}
                onChange={(v) => setSlide(i, 'title', v)}
                placeholder="New Collection"
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={slide.subtitle}
                onChange={(v) => setSlide(i, 'subtitle', v)}
                placeholder="Discover our latest arrivals"
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Button label">
                <TextInput
                  value={slide.ctaLabel}
                  onChange={(v) => setSlide(i, 'ctaLabel', v)}
                  placeholder="Shop now"
                />
              </Field>
              <Field label="Button link">
                <LinkInput value={slide.ctaUrl} onChange={(v) => setSlide(i, 'ctaUrl', v)} />
              </Field>
            </div>
          </SectionCard>
        ))}
        <AddBtn onClick={addSlide} label="Add a slide" />
      </Field>
    </div>
  )
}

function FeaturedProductsForm({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <div>
      <Field label="Section title">
        <TextInput
          value={(config.title as string) ?? ''}
          onChange={(v) => set('title', v)}
          placeholder="New arrivals"
        />
      </Field>
      <Field label="Number of columns">
        <Select
          value={String((config.columns as number) ?? 4)}
          onChange={(v) => set('columns', Number(v))}
          options={[
            { value: '2', label: '2 columns' },
            { value: '3', label: '3 columns' },
            { value: '4', label: '4 columns' },
          ]}
        />
      </Field>
    </div>
  )
}

function CategoryShowcaseForm({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <Field label="Section title">
      <TextInput
        value={(config.title as string) ?? ''}
        onChange={(v) => set('title', v)}
        placeholder="Shop by category"
      />
    </Field>
  )
}

function NewsletterForm({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <div>
      <Field label="Title">
        <TextInput
          value={(config.title as string) ?? ''}
          onChange={(v) => set('title', v)}
          placeholder="Stay in the loop"
        />
      </Field>
      <Field label="Subtitle">
        <TextInput
          value={(config.subtitle as string) ?? ''}
          onChange={(v) => set('subtitle', v)}
          placeholder="Get the latest news and offers"
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Placeholder">
          <TextInput
            value={(config.placeholder as string) ?? ''}
            onChange={(v) => set('placeholder', v)}
            placeholder="Your email"
          />
        </Field>
        <Field label="Button label">
          <TextInput
            value={(config.buttonLabel as string) ?? ''}
            onChange={(v) => set('buttonLabel', v)}
            placeholder="Subscribe"
          />
        </Field>
      </div>
    </div>
  )
}

function EditorialHeroForm({
  config,
  onChange,
  uk,
}: { config: Config; onChange: (c: Config) => void; uk: string }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <div>
      <Field label="Title">
        <TextInput
          value={(config.title as string) ?? ''}
          onChange={(v) => set('title', v)}
          placeholder="The new season"
        />
      </Field>
      <Field label="Subtitle">
        <TextInput
          value={(config.subtitle as string) ?? ''}
          onChange={(v) => set('subtitle', v)}
          placeholder="A collection of carefully curated pieces"
        />
      </Field>
      <Field label="Image">
        <ImageInput
          value={(config.image as string) ?? ''}
          onChange={(v) => set('image', v)}
          unsplashKey={uk}
          defaultQuery="editorial fashion portrait"
        />
      </Field>
      <Field label="Image position">
        <Select
          value={(config.imagePosition as string) ?? 'right'}
          onChange={(v) => set('imagePosition', v)}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Button label">
          <TextInput
            value={(config.ctaLabel as string) ?? ''}
            onChange={(v) => set('ctaLabel', v)}
            placeholder="Discover"
          />
        </Field>
        <Field label="Button link">
          <LinkInput value={(config.ctaUrl as string) ?? ''} onChange={(v) => set('ctaUrl', v)} />
        </Field>
      </div>
    </div>
  )
}

function EditorialStoryForm({
  config,
  onChange,
  uk,
}: { config: Config; onChange: (c: Config) => void; uk: string }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <div>
      <Field label="Title">
        <TextInput value={(config.title as string) ?? ''} onChange={(v) => set('title', v)} />
      </Field>
      <Field label="Body text">
        <textarea
          value={(config.body as string) ?? ''}
          onChange={(e) => set('body', e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Write your story here..."
        />
      </Field>
      <Field label="Image">
        <ImageInput
          value={(config.image as string) ?? ''}
          onChange={(v) => set('image', v)}
          unsplashKey={uk}
          defaultQuery="lifestyle fashion studio"
        />
      </Field>
    </div>
  )
}

function EditorialFeaturedForm({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <div>
      <Field label="Title">
        <TextInput
          value={(config.title as string) ?? ''}
          onChange={(v) => set('title', v)}
          placeholder="The piece of the season"
        />
      </Field>
      <Field label="Quote / caption">
        <textarea
          value={(config.quote as string) ?? ''}
          onChange={(e) => set('quote', e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>
    </div>
  )
}

function LookbookHeroForm({
  config,
  onChange,
  uk,
}: { config: Config; onChange: (c: Config) => void; uk: string }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  const mediaType = (config.mediaType as string) ?? 'image'
  return (
    <div>
      <Field label="Title">
        <TextInput
          value={(config.title as string) ?? ''}
          onChange={(v) => set('title', v)}
          placeholder="THE EDIT"
        />
      </Field>
      <Field label="Subtitle">
        <TextInput
          value={(config.subtitle as string) ?? ''}
          onChange={(v) => set('subtitle', v)}
          placeholder="Spring / Summer 2026"
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Button label">
          <TextInput
            value={(config.ctaLabel as string) ?? ''}
            onChange={(v) => set('ctaLabel', v)}
            placeholder="Shop the look"
          />
        </Field>
        <Field label="Button link">
          <LinkInput value={(config.ctaUrl as string) ?? ''} onChange={(v) => set('ctaUrl', v)} />
        </Field>
      </div>
      <Field label="Media type">
        <Select
          value={mediaType}
          onChange={(v) => set('mediaType', v)}
          options={[
            { value: 'image', label: 'Image' },
            { value: 'video', label: 'Video (MP4 URL)' },
          ]}
        />
      </Field>
      <Field label={mediaType === 'video' ? 'Video URL (.mp4)' : 'Background image'}>
        {mediaType === 'image' ? (
          <ImageInput
            value={(config.mediaUrl as string) ?? ''}
            onChange={(v) => set('mediaUrl', v)}
            unsplashKey={uk}
            defaultQuery="lookbook fashion dark editorial"
          />
        ) : (
          <input
            type="url"
            value={(config.mediaUrl as string) ?? ''}
            onChange={(e) => set('mediaUrl', e.target.value)}
            placeholder="https://…/video.mp4"
            style={inputStyle}
          />
        )}
      </Field>
      <Field label="Overlay opacity" hint="0 = transparent · 1 = fully dark">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={(config.overlayOpacity as number) ?? 0.4}
            onChange={(e) => set('overlayOpacity', Number(e.target.value))}
            style={{ width: 160 }}
          />
          <span style={{ fontSize: 13, color: '#374151', minWidth: 32 }}>
            {((config.overlayOpacity as number) ?? 0.4).toFixed(2)}
          </span>
        </div>
      </Field>
    </div>
  )
}

type GridItem = {
  id: string
  image: string
  productId: string | null
  label: string
  size: 'small' | 'large'
}

function LookbookGridForm({
  config,
  onChange,
  uk,
}: { config: Config; onChange: (c: Config) => void; uk: string }) {
  const items = (config.items as GridItem[] | undefined) ?? []
  const setItem = (i: number, key: keyof GridItem, val: unknown) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it))
    onChange({ ...config, items: next })
  }
  const addItem = () =>
    onChange({
      ...config,
      items: [
        ...items,
        { id: String(Date.now()), image: '', productId: null, label: '', size: 'small' },
      ],
    })
  const removeItem = (i: number) =>
    onChange({ ...config, items: items.filter((_, idx) => idx !== i) })

  return (
    <div>
      <Field label="Grid cells">
        {items.map((item, i) => (
          <SectionCard key={item.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Cell {i + 1}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  value={item.size}
                  onChange={(v) => setItem(i, 'size', v)}
                  options={[
                    { value: 'small', label: 'Small (1×1)' },
                    { value: 'large', label: 'Large (2×2)' },
                  ]}
                />
                <RemoveBtn onClick={() => removeItem(i)} />
              </div>
            </div>
            <Field label="Image">
              <ImageInput
                value={item.image}
                onChange={(v) => setItem(i, 'image', v)}
                unsplashKey={uk}
                defaultQuery="fashion lookbook editorial"
              />
            </Field>
            <Field label="Label (displayed on hover)">
              <TextInput
                value={item.label}
                onChange={(v) => setItem(i, 'label', v)}
                placeholder="Editorial"
              />
            </Field>
          </SectionCard>
        ))}
        <AddBtn onClick={addItem} label="Add a cell" />
      </Field>
    </div>
  )
}

function LookbookCollectionForm({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  return (
    <Field label="Section title">
      <TextInput
        value={(config.title as string) ?? ''}
        onChange={(v) => set('title', v)}
        placeholder="Featured pieces"
      />
    </Field>
  )
}

// ── Form dispatcher ───────────────────────────────────────────────────────────

type FormProps = { config: Config; onChange: (c: Config) => void; uk: string }

const SECTION_FORMS: Record<string, React.ComponentType<FormProps>> = {
  hero_slider: HeroSliderForm,
  featured_products: (p) => <FeaturedProductsForm config={p.config} onChange={p.onChange} />,
  category_showcase: (p) => <CategoryShowcaseForm config={p.config} onChange={p.onChange} />,
  newsletter: (p) => <NewsletterForm config={p.config} onChange={p.onChange} />,
  editorial_hero: EditorialHeroForm,
  editorial_story: EditorialStoryForm,
  editorial_featured: (p) => <EditorialFeaturedForm config={p.config} onChange={p.onChange} />,
  lookbook_hero: LookbookHeroForm,
  lookbook_grid: LookbookGridForm,
  lookbook_collection: (p) => <LookbookCollectionForm config={p.config} onChange={p.onChange} />,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ThemeEditorPage() {
  const { data: adminConfig, refetch: refetchConfig } = trpc.admin.config.get.useQuery()
  const activeTheme = (adminConfig?.theme ?? 'classic') as string
  const unsplashKey =
    ((adminConfig as Record<string, unknown> | undefined)?.unsplashAccessKey as string) ?? ''

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const theme = selectedTheme ?? activeTheme

  const { data: sections = [], refetch } = trpc.cms.themeSections.list.useQuery({ theme })
  const seedMut = trpc.cms.themeSections.seedDefaults.useMutation({
    onSuccess: () => void refetch(),
  })
  const setActiveMut = trpc.cms.themeSections.setActive.useMutation({
    onSuccess: () => void refetch(),
  })
  const deleteMut = trpc.cms.themeSections.delete.useMutation({ onSuccess: () => void refetch() })
  const updateThemeMut = trpc.admin.config.update.useMutation({
    onSuccess: () => void refetchConfig(),
  })
  const upsertMut = trpc.cms.themeSections.upsert.useMutation({
    onSuccess: () => {
      void refetch()
      setEditingId(null)
    },
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editConfig, setEditConfig] = useState<Config>({})

  function startEdit(id: string, cfg: Config) {
    setEditingId(id)
    setEditConfig(cfg)
  }

  function saveEdit(id: string, sectionType: string, position: number) {
    upsertMut.mutate({ id, theme, sectionType, position, config: editConfig, isActive: true })
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
          Theme Editor
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Configure the sections displayed on your storefront homepage.
        </p>
      </div>

      {/* Theme tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        {Object.entries(THEME_LABELS).map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => {
              setSelectedTheme(key)
              setEditingId(null)
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: theme === key ? '#111' : '#f3f4f6',
              color: theme === key ? '#fff' : '#374151',
              border: activeTheme === key ? '2px solid #10b981' : '2px solid transparent',
            }}
          >
            {label}
            {activeTheme === key && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  background: '#10b981',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 99,
                }}
              >
                ACTIVE
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            updateThemeMut.mutate({
              theme: theme as 'classic' | 'editorial' | 'lookbook' | 'minimal',
            })
          }
          disabled={theme === activeTheme || updateThemeMut.isPending}
          style={{
            marginLeft: 'auto',
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            background: '#10b981',
            color: '#fff',
            border: 'none',
            opacity: theme === activeTheme ? 0.4 : 1,
          }}
        >
          {updateThemeMut.isPending ? 'Saving…' : `Set "${THEME_LABELS[theme]}" as active`}
        </button>
      </div>

      {/* Design tokens (no-code theming) */}
      <DesignTokensPanel
        branding={(adminConfig?.branding ?? {}) as BrandingTokens}
        onSave={(branding) => updateThemeMut.mutate({ branding })}
        saving={updateThemeMut.isPending}
      />

      {/* Sections */}
      {sections.length === 0 ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px dashed #d1d5db',
          }}
        >
          <p style={{ color: '#9ca3af', marginBottom: 16 }}>
            No sections configured for the {THEME_LABELS[theme]} theme.
          </p>
          <button
            type="button"
            onClick={() => seedMut.mutate({ theme })}
            disabled={seedMut.isPending}
            style={{
              padding: '10px 24px',
              background: '#111',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {seedMut.isPending ? 'Loading…' : 'Load default sections'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((section) => {
            const FormComponent = SECTION_FORMS[section.sectionType]
            const isEditing = editingId === section.id
            return (
              <div
                key={section.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: section.isActive ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 20px',
                    background: '#fff',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: section.isActive ? '#10b981' : '#d1d5db',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                      {SECTION_LABELS[section.sectionType] ?? section.sectionType}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af' }}>Position {section.position}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? setEditingId(null)
                          : startEdit(section.id, section.config as Config)
                      }
                      style={actionBtn(isEditing ? '#111' : '#f3f4f6', isEditing ? '#fff' : '#111')}
                    >
                      {isEditing ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMut.mutate({ id: section.id, isActive: !section.isActive })
                      }
                      style={actionBtn(
                        section.isActive ? '#fef3c7' : '#f0fdf4',
                        section.isActive ? '#92400e' : '#166534',
                      )}
                    >
                      {section.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this section?')) deleteMut.mutate({ id: section.id })
                      }}
                      style={actionBtn('#fee2e2', '#991b1b')}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isEditing && FormComponent && (
                  <div
                    style={{
                      padding: '24px 20px',
                      background: '#fafafa',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    <FormComponent config={editConfig} onChange={setEditConfig} uk={unsplashKey} />
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: '1px solid #e5e7eb',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => saveEdit(section.id, section.sectionType, section.position)}
                        disabled={upsertMut.isPending}
                        style={{
                          padding: '9px 22px',
                          background: '#111',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                      >
                        {upsertMut.isPending ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '9px 22px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {isEditing && !FormComponent && (
                  <div
                    style={{ padding: 20, background: '#fafafa', borderTop: '1px solid #e5e7eb' }}
                  >
                    <p style={{ fontSize: 13, color: '#6b7280' }}>
                      No editor available for this section type.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: bg,
    color,
    border: 'none',
  }
}

// ── Design tokens panel (no-code theming) ──────────────────────────────────────
export type BrandingTokens = {
  primaryColor?: string
  bgColor?: string
  surfaceColor?: string
  textColor?: string
  mutedColor?: string
  borderColor?: string
  fontHeading?: string
  fontBody?: string
  radius?: string
}

const TOKEN_COLORS: { key: keyof BrandingTokens; label: string; fallback: string }[] = [
  { key: 'primaryColor', label: 'Primary / accent', fallback: '#4f46e5' },
  { key: 'bgColor', label: 'Background', fallback: '#ffffff' },
  { key: 'surfaceColor', label: 'Surface / cards', fallback: '#ffffff' },
  { key: 'textColor', label: 'Text', fallback: '#111111' },
  { key: 'mutedColor', label: 'Muted text', fallback: '#6b7280' },
  { key: 'borderColor', label: 'Borders', fallback: '#e5e7eb' },
]

const FONT_OPTIONS = [
  { value: '', label: 'Theme default' },
  { value: "'Inter', sans-serif", label: 'Inter (modern sans)' },
  { value: "'Poppins', sans-serif", label: 'Poppins (geometric)' },
  { value: 'Georgia, serif', label: 'Georgia (serif)' },
  { value: "'Playfair Display', serif", label: 'Playfair (editorial serif)' },
  { value: "'Courier New', monospace", label: 'Mono' },
]

function DesignTokensPanel({
  branding,
  onSave,
  saving,
}: {
  branding: BrandingTokens
  onSave: (b: BrandingTokens) => void
  saving: boolean
}) {
  const [tokens, setTokens] = useState<BrandingTokens>(branding)
  useEffect(() => {
    setTokens(branding)
  }, [branding])

  // Named theme presets (saved token snapshots)
  const utils = trpc.useUtils()
  const { data: presets = {} } = trpc.admin.themes.listPresets.useQuery()
  const refetchPresets = () => void utils.admin.themes.listPresets.invalidate()
  const savePresetMut = trpc.admin.themes.savePreset.useMutation({ onSuccess: refetchPresets })
  const deletePresetMut = trpc.admin.themes.deletePreset.useMutation({ onSuccess: refetchPresets })

  function set<K extends keyof BrandingTokens>(key: K, value: string) {
    setTokens((t) => ({ ...t, [key]: value }))
  }

  function saveAsPreset() {
    const name = prompt('Name this theme preset:')?.trim()
    if (!name) return
    const clean = Object.fromEntries(
      Object.entries(tokens).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>
    savePresetMut.mutate({ name, tokens: clean })
  }

  function applyPreset(preset: Record<string, string>) {
    setTokens(preset as BrandingTokens)
    onSave(preset as BrandingTokens)
  }

  // Resolve effective token values for the live preview (token → fallback)
  const fb = (v: string | undefined, d: string) => (v && v.trim() ? v : d)
  const pv = {
    primary: fb(tokens.primaryColor, '#4f46e5'),
    bg: fb(tokens.bgColor, '#ffffff'),
    surface: fb(tokens.surfaceColor, '#ffffff'),
    text: fb(tokens.textColor, '#111111'),
    muted: fb(tokens.mutedColor, '#6b7280'),
    border: fb(tokens.borderColor, '#e5e7eb'),
    radius: fb(tokens.radius, '0.75rem'),
    fontHeading: fb(tokens.fontHeading, 'inherit'),
    fontBody: fb(tokens.fontBody, 'inherit'),
  }

  function exportJson() {
    void navigator.clipboard.writeText(JSON.stringify(tokens, null, 2))
  }

  function importJson() {
    const raw = prompt('Paste a theme JSON to import:')
    if (!raw) return
    try {
      setTokens({ ...tokens, ...(JSON.parse(raw) as BrandingTokens) })
    } catch {
      alert('Invalid JSON')
    }
  }

  return (
    <div
      style={{
        marginBottom: 32,
        padding: 24,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Design tokens</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
            Customise colours, fonts and rounding — applied live on the storefront, no rebuild.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={exportJson} style={ghostBtn}>
            Export
          </button>
          <button type="button" onClick={importJson} style={ghostBtn}>
            Import
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 14,
        }}
      >
        {TOKEN_COLORS.map(({ key, label, fallback }) => (
          <div key={key}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 4,
              }}
            >
              {label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={tokens[key] || fallback}
                onChange={(e) => set(key, e.target.value)}
                style={{
                  width: 40,
                  height: 32,
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'none',
                }}
              />
              <input
                type="text"
                value={tokens[key] ?? ''}
                placeholder={fallback}
                onChange={(e) => set(key, e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 12,
                  color: '#111',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14,
          marginTop: 16,
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4,
            }}
          >
            Heading font
          </label>
          <select
            value={tokens.fontHeading ?? ''}
            onChange={(e) => set('fontHeading', e.target.value)}
            style={{
              width: '100%',
              padding: '7px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              color: '#111',
              background: '#fff',
            }}
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4,
            }}
          >
            Body font
          </label>
          <select
            value={tokens.fontBody ?? ''}
            onChange={(e) => set('fontBody', e.target.value)}
            style={{
              width: '100%',
              padding: '7px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              color: '#111',
              background: '#fff',
            }}
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 4,
            }}
          >
            Corner radius
          </label>
          <input
            type="text"
            value={tokens.radius ?? ''}
            placeholder="0.75rem"
            onChange={(e) => set('radius', e.target.value)}
            style={{
              width: '100%',
              padding: '7px 8px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              fontSize: 13,
              color: '#111',
            }}
          />
        </div>
      </div>

      {/* Live preview */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          Live preview
        </p>
        <div
          style={{
            background: pv.bg,
            border: `1px solid ${pv.border}`,
            borderRadius: pv.radius,
            padding: 20,
            fontFamily: pv.fontBody,
            color: pv.text,
          }}
        >
          <div
            style={{
              fontFamily: pv.fontHeading,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            Summer Collection
          </div>
          <div style={{ color: pv.muted, fontSize: 13, marginBottom: 16 }}>
            Discover the new season essentials.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div
              style={{
                background: pv.surface,
                border: `1px solid ${pv.border}`,
                borderRadius: pv.radius,
                padding: 12,
                width: 150,
              }}
            >
              <div
                style={{
                  background: pv.border,
                  borderRadius: pv.radius,
                  height: 70,
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Product name</div>
              <div style={{ color: pv.primary, fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                €49.00
              </div>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}
            >
              <button
                type="button"
                style={{
                  background: pv.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: pv.radius,
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Add to cart
              </button>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  color: pv.text,
                  border: `1px solid ${pv.border}`,
                  borderRadius: pv.radius,
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Wishlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved presets */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Saved themes</p>
          <button
            type="button"
            onClick={saveAsPreset}
            disabled={savePresetMut.isPending}
            style={{ ...ghostBtn, marginLeft: 'auto' }}
          >
            + Save current as preset
          </button>
        </div>
        {Object.keys(presets).length === 0 ? (
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            No saved themes yet. Tune the tokens above, then save them as a reusable preset.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(presets).map(([name, preset]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
              >
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  {['primaryColor', 'bgColor', 'textColor'].map((k) => (
                    <span
                      key={k}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: preset[k] || '#ddd',
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                  ))}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{name}</span>
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  disabled={saving}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#10b981',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete preset "${name}"?`)) deletePresetMut.mutate({ name })
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button
          type="button"
          onClick={() => onSave(tokens)}
          disabled={saving}
          style={{
            padding: '9px 22px',
            background: '#111',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save design'}
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              primaryColor: '',
              bgColor: '',
              surfaceColor: '',
              textColor: '',
              mutedColor: '',
              borderColor: '',
              fontHeading: '',
              fontBody: '',
              radius: '',
            })
          }
          disabled={saving}
          style={ghostBtn}
        >
          Reset to theme defaults
        </button>
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
}
