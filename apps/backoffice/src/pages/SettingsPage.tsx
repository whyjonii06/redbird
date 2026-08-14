import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { trpc } from '../trpc.js'
import { getTheme, setTheme, type Theme } from '../theme.js'

const THEMES: Array<{ id: Theme; label: string; desc: string }> = [
  { id: 'dark', label: 'Dark', desc: 'Near-black background, red accent' },
  { id: 'light', label: 'Light', desc: 'White background, clean layout' },
]

type StorefrontTheme = 'classic' | 'editorial' | 'minimal'

const STOREFRONT_THEMES: Array<{
  id: StorefrontTheme
  label: string
  desc: string
  primary: string
  bg: string
  surface: string
  border: string
  navBg: string
  navBorder: string
}> = [
  {
    id: 'classic',
    label: 'Classic',
    desc: 'White background, indigo accent — clean and timeless',
    primary: '#4f46e5',
    bg: '#ffffff',
    surface: '#f9fafb',
    border: '#e5e7eb',
    navBg: '#ffffff',
    navBorder: '#e5e7eb',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    desc: 'Warm cream background, serif feel, copper accent',
    primary: '#b3552c',
    bg: '#faf8f5',
    surface: '#ffffff',
    border: '#e8e0d8',
    navBg: '#faf8f5',
    navBorder: '#e8e0d8',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Pure white, sharp corners, near-black accent',
    primary: '#111111',
    bg: '#ffffff',
    surface: '#fafafa',
    border: '#eeeeee',
    navBg: '#ffffff',
    navBorder: '#eeeeee',
  },
]

export function SettingsPage() {
  const configQuery = trpc.admin.config.get.useQuery()
  const { data, isLoading } = configQuery
  const { t } = useI18n()
  const [currentTheme, setCurrentTheme] = useState<Theme>(getTheme)
  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [seedError, setSeedError] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('5')
  const [alertSaved, setAlertSaved] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseSaved, setLicenseSaved] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [tagline, setTagline] = useState('')
  const [storeSaved, setStoreSaved] = useState(false)
  const [seller, setSeller] = useState({
    name: '',
    vatNumber: '',
    legalRegistrationId: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    countryCode: '',
    email: '',
  })
  const [sellerSaved, setSellerSaved] = useState(false)

  const storeMut = trpc.admin.config.update.useMutation({
    onSuccess: () => {
      setStoreSaved(true)
      setTimeout(() => setStoreSaved(false), 3000)
      void configQuery.refetch()
    },
  })

  const sellerMut = trpc.admin.config.update.useMutation({
    onSuccess: () => {
      setSellerSaved(true)
      setTimeout(() => setSellerSaved(false), 3000)
      void configQuery.refetch()
    },
  })

  function saveSeller() {
    sellerMut.mutate({
      seller: {
        name: seller.name,
        address: {
          line1: seller.line1,
          ...(seller.line2 ? { line2: seller.line2 } : {}),
          postalCode: seller.postalCode,
          city: seller.city,
          countryCode: seller.countryCode,
        },
        ...(seller.vatNumber ? { vatNumber: seller.vatNumber } : {}),
        ...(seller.legalRegistrationId
          ? { legalRegistrationId: seller.legalRegistrationId }
          : {}),
        ...(seller.email ? { email: seller.email } : {}),
      },
    })
  }

  const updateConfigMut = trpc.admin.config.update.useMutation({
    onSuccess: () => {
      void configQuery.refetch()
    },
  })
  const alertMut = trpc.admin.config.update.useMutation({
    onSuccess: () => {
      setAlertSaved(true)
      setTimeout(() => setAlertSaved(false), 3000)
    },
  })
  const licenseMut = trpc.admin.config.update.useMutation({
    onSuccess: () => {
      setLicenseSaved(true)
      setTimeout(() => setLicenseSaved(false), 3000)
      void configQuery.refetch()
    },
  })

  const utils = trpc.useUtils()
  const fecYear = new Date().getFullYear()
  const [fecFrom, setFecFrom] = useState(`${fecYear}-01-01`)
  const [fecTo, setFecTo] = useState(`${fecYear}-12-31`)
  const [fecBusy, setFecBusy] = useState(false)

  async function downloadFec() {
    setFecBusy(true)
    try {
      const res = await utils.admin.accounting.exportFec.fetch({ from: fecFrom, to: fecTo })
      if (!res.count) {
        alert(t('settings.fec.none'))
        return
      }
      const blob = new Blob([res.fec], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `FEC-${fecFrom}_${fecTo}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setFecBusy(false)
    }
  }

  const seedMut = trpc.admin.seedDemo.useMutation({
    onSuccess: () => setSeedStatus('done'),
    onError: (e) => {
      setSeedStatus('error')
      setSeedError(e.message)
    },
  })

  useEffect(() => {
    if (data?.stockAlertEmail !== undefined) setAlertEmail(data.stockAlertEmail)
    if (data?.stockAlertThreshold !== undefined) setAlertThreshold(String(data.stockAlertThreshold))
    if (data?.licenseKey !== undefined) setLicenseKey(data.licenseKey)
    if (data?.storeName !== undefined) setStoreName(data.storeName)
    if (data?.branding?.tagline !== undefined) setTagline(data.branding.tagline)
    if (data?.seller) {
      const s = data.seller
      setSeller({
        name: s.name ?? '',
        vatNumber: s.vatNumber ?? '',
        legalRegistrationId: s.legalRegistrationId ?? '',
        line1: s.address?.line1 ?? '',
        line2: s.address?.line2 ?? '',
        postalCode: s.address?.postalCode ?? '',
        city: s.address?.city ?? '',
        countryCode: s.address?.countryCode ?? '',
        email: s.email ?? '',
      })
    }
  }, [data?.stockAlertEmail, data?.stockAlertThreshold, data?.licenseKey, data?.storeName, data?.branding?.tagline, data?.seller])

  function handleTheme(t: Theme) {
    setTheme(t)
    setCurrentTheme(t)
  }

  function handleSeed() {
    if (!confirm('This will add demo products, customers and orders. Continue?')) return
    setSeedStatus('loading')
    setSeedError('')
    seedMut.mutate()
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* License */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          {t('settings.license')}
        </h2>
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          {/* Current status */}
          {data && (
            <div
              className="flex items-center gap-3 pb-4"
              style={{ borderBottom: '1px solid var(--bo-border)' }}
            >
              {data.licenseKey ? (
                <>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                  >
                    PRO
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--bo-muted)' }}>
                    {data.licenseKey.slice(0, 12)}••••••••
                  </span>
                </>
              ) : (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--bo-bg3)', color: 'var(--bo-muted)' }}
                >
                  FREE
                </span>
              )}
            </div>
          )}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bo-muted)' }}
            >
              {t('settings.licenseKey')}
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="rb_live_..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono"
              style={{
                background: 'var(--bo-bg3)',
                border: '1px solid var(--bo-border)',
                color: 'var(--bo-text)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bo-muted)' }}>
              Get your key at{' '}
              <a
                href="http://localhost:5174/pricing"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--bo-accent)' }}
              >
                marketplace.redbird.io
              </a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => licenseMut.mutate({ licenseKey })}
              disabled={licenseMut.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'var(--bo-accent)', color: '#fff' }}
            >
              {licenseMut.isPending ? 'Verifying…' : 'Save & verify'}
            </button>
            {licenseSaved && (
              <span className="text-xs font-medium" style={{ color: '#4ade80' }}>
                License verified.
              </span>
            )}
            {licenseMut.isError && (
              <span className="text-xs" style={{ color: 'var(--bo-accent)' }}>
                {licenseMut.error.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Store config */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          {t('settings.storeConfig')}
        </h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          {isLoading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
          ) : data ? (
            <>
              <div
                className="flex items-center px-5 py-4"
                style={{ borderBottom: '1px solid var(--bo-border)' }}
              >
                <span className="w-48 text-sm font-medium text-gray-600">
                  {t('settings.storeName')}
                </span>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="My Store"
                  className="flex-1 max-w-xs text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div
                className="flex items-center px-5 py-4"
                style={{ borderBottom: '1px solid var(--bo-border)' }}
              >
                <span className="w-48 text-sm font-medium text-gray-600">
                  {t('settings.tagline')}
                </span>
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder={t('settings.taglinePlaceholder')}
                  className="flex-1 max-w-md text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => storeMut.mutate({ storeName, branding: { tagline } })}
                  disabled={storeMut.isPending}
                  className="ml-3 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: 'var(--bo-accent)' }}
                >
                  {storeMut.isPending ? 'Saving…' : storeSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              <Row label={t('settings.defaultCurrency')} value={data.defaultCurrency} />
              {data.defaultPaymentProvider ? (
                <Row label={t('settings.paymentProvider')} value={data.defaultPaymentProvider} />
              ) : (
                <Row label={t('settings.paymentProvider')} value={t('common.none')} configAnchor="Payment" />
              )}
              {data.defaultEmailProvider ? (
                <Row label={t('settings.emailProvider')} value={data.defaultEmailProvider} />
              ) : (
                <Row label={t('settings.emailProvider')} value={t('common.none')} configAnchor="Email" />
              )}
              <div
                className="flex items-center px-5 py-4"
                style={{ borderBottom: '1px solid var(--bo-border)' }}
              >
                <span className="w-48 text-sm font-medium text-gray-600">
                  {t('settings.priceDisplay')}
                </span>
                <select
                  value={data.priceDisplay ?? 'none'}
                  onChange={(e) =>
                    updateConfigMut.mutate({
                      priceDisplay: e.target.value as 'incl_tax' | 'excl_tax' | 'none',
                    })
                  }
                  className="text-sm rounded-lg border border-gray-200 px-2 py-1 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="none">{t('settings.priceNone')}</option>
                  <option value="incl_tax">{t('settings.priceIncl')}</option>
                  <option value="excl_tax">{t('settings.priceExcl')}</option>
                </select>
              </div>
            </>
          ) : null}
        </div>
        <p className="text-xs text-gray-400">
          Payment and email providers can be configured from the{' '}
          <Link to="/marketplace" className="text-indigo-500 hover:underline">
            Marketplace
          </Link>
          . Other values require updating your{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">createRedbird</code> call.
        </p>
      </section>

      {/* Seller legal identity (Factur-X) */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          {t('settings.seller.title')}
        </h2>
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--bo-muted)' }}>
            {t('settings.seller.intro')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['name', 'settings.seller.name'],
                ['vatNumber', 'settings.seller.vat'],
                ['legalRegistrationId', 'settings.seller.siren'],
                ['email', 'settings.seller.email'],
                ['line1', 'settings.seller.line1'],
                ['line2', 'settings.seller.line2'],
                ['postalCode', 'settings.seller.postalCode'],
                ['city', 'settings.seller.city'],
                ['countryCode', 'settings.seller.country'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--bo-muted)' }}
                >
                  {t(label)}
                </label>
                <input
                  value={seller[key]}
                  onChange={(e) => setSeller((s) => ({ ...s, [key]: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={saveSeller}
            disabled={sellerMut.isPending || !seller.name}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: 'var(--bo-accent)' }}
          >
            {sellerMut.isPending
              ? t('common.saving')
              : sellerSaved
                ? t('common.saved')
                : t('common.save')}
          </button>
        </div>
      </section>

      {/* Accounting — FEC export */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          {t('settings.fec.title')}
        </h2>
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--bo-muted)' }}>
            {t('settings.fec.intro')}
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bo-muted)' }}>
                {t('settings.fec.from')}
              </label>
              <input
                type="date"
                value={fecFrom}
                onChange={(e) => setFecFrom(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bo-muted)' }}>
                {t('settings.fec.to')}
              </label>
              <input
                type="date"
                value={fecTo}
                onChange={(e) => setFecTo(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button
              type="button"
              onClick={() => void downloadFec()}
              disabled={fecBusy}
              className="text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'var(--bo-accent)' }}
            >
              {fecBusy ? t('common.loading') : t('settings.fec.download')}
            </button>
          </div>
        </div>
      </section>

      {/* Stock alerts */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Stock alerts
        </h2>
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bo-muted)' }}
            >
              Alert email
            </label>
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              placeholder="admin@mystore.com"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bo-bg3)',
                border: '1px solid var(--bo-border)',
                color: 'var(--bo-text)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bo-muted)' }}>
              Leave empty to disable stock alerts.
            </p>
          </div>
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bo-muted)' }}
            >
              Alert threshold
            </label>
            <input
              type="number"
              min={0}
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="w-32 rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--bo-bg3)',
                border: '1px solid var(--bo-border)',
                color: 'var(--bo-text)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bo-muted)' }}>
              Send an alert when available stock falls at or below this number.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                alertMut.mutate({
                  stockAlertEmail: alertEmail,
                  stockAlertThreshold: parseInt(alertThreshold, 10) || 5,
                })
              }
              disabled={alertMut.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'var(--bo-accent)', color: '#fff' }}
            >
              {alertMut.isPending ? 'Saving…' : 'Save'}
            </button>
            {alertSaved && (
              <span className="text-xs font-medium" style={{ color: '#4ade80' }}>
                Saved.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Storefront theme */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Storefront theme
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {STOREFRONT_THEMES.map((t) => {
            const isActive = (data?.theme ?? 'classic') === t.id
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => updateConfigMut.mutate({ theme: t.id })}
                disabled={updateConfigMut.isPending}
                className="text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60"
                style={
                  isActive
                    ? { borderColor: 'var(--bo-accent)', background: 'rgba(232,48,42,0.06)' }
                    : { borderColor: 'var(--bo-border)', background: 'var(--bo-bg2)' }
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                  {isActive && (
                    <span className="text-xs font-medium" style={{ color: 'var(--bo-accent)' }}>
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">{t.desc}</p>
                {/* Mini storefront preview */}
                <div
                  className="h-14 rounded-lg overflow-hidden flex flex-col"
                  style={{ background: t.bg, border: `1px solid ${t.border}` }}
                >
                  {/* Nav bar */}
                  <div
                    className="flex items-center px-2 gap-1.5 h-5 flex-shrink-0"
                    style={{ background: t.navBg, borderBottom: `1px solid ${t.navBorder}` }}
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: t.primary }}
                    />
                    <div className="h-1 rounded flex-1" style={{ background: t.border }} />
                    <div className="h-1.5 w-3 rounded" style={{ background: t.primary }} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-1.5 space-y-1">
                    <div className="h-1.5 rounded w-3/4" style={{ background: t.border }} />
                    <div
                      className="h-1 rounded w-1/2"
                      style={{ background: t.surface !== t.bg ? t.border : '#e5e7eb' }}
                    />
                    <div
                      className="h-2 rounded w-1/3 mt-0.5"
                      style={{ background: t.primary, opacity: 0.85 }}
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {updateConfigMut.isError && (
          <p className="text-xs text-red-400">{updateConfigMut.error.message}</p>
        )}
        {updateConfigMut.isSuccess && (
          <p className="text-xs" style={{ color: '#4ade80' }}>
            Storefront theme updated.
          </p>
        )}
        <p className="text-xs text-gray-400">
          Applies to all visitors of the storefront immediately.
        </p>
      </section>

      {/* Price display */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Price display
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'none' as const, label: 'No label', desc: 'Price shown without tax info' },
            { id: 'excl_tax' as const, label: 'Excl. tax', desc: 'Shows "Excl. tax" below price' },
            {
              id: 'incl_tax' as const,
              label: 'Incl. tax',
              desc: 'Shows "Tax included" below price',
            },
          ].map((opt) => {
            const isActive = (data?.priceDisplay ?? 'none') === opt.id
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => updateConfigMut.mutate({ priceDisplay: opt.id })}
                disabled={updateConfigMut.isPending}
                className="text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60"
                style={
                  isActive
                    ? { borderColor: 'var(--bo-accent)', background: 'rgba(232,48,42,0.06)' }
                    : { borderColor: 'var(--bo-border)', background: 'var(--bo-bg2)' }
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--bo-text)' }}>
                    {opt.label}
                  </span>
                  {isActive && (
                    <span className="text-xs font-medium" style={{ color: 'var(--bo-accent)' }}>
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--bo-muted)' }}>
                  {opt.desc}
                </p>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400">
          Displayed on product pages. For EU compliance, use "Excl. tax" (B2B) or "Incl. tax" (B2C).
        </p>
      </section>

      {/* Backoffice theme */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Backoffice theme
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => handleTheme(t.id)}
              className="text-left p-4 rounded-xl border-2 transition-all"
              style={
                currentTheme === t.id
                  ? { borderColor: 'var(--bo-accent)', background: 'rgba(232,48,42,0.06)' }
                  : { borderColor: 'var(--bo-border)', background: 'var(--bo-bg2)' }
              }
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                {currentTheme === t.id && (
                  <span className="text-xs font-medium" style={{ color: 'var(--bo-accent)' }}>
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{t.desc}</p>
              {/* Mini preview */}
              <div
                className="mt-3 h-10 rounded-lg overflow-hidden flex"
                style={{
                  background: t.id === 'dark' ? '#080808' : '#f4f4f5',
                  border: '1px solid',
                  borderColor: t.id === 'dark' ? '#1e1e1e' : '#e4e4e7',
                }}
              >
                <div
                  className="w-8 flex-shrink-0"
                  style={{
                    background: t.id === 'dark' ? '#101010' : '#ffffff',
                    borderRight: '1px solid',
                    borderColor: t.id === 'dark' ? '#1e1e1e' : '#e4e4e7',
                  }}
                />
                <div className="flex-1 p-1.5 space-y-1">
                  <div
                    className="h-1.5 rounded w-2/3"
                    style={{ background: t.id === 'dark' ? '#2a2a2a' : '#e5e5e5' }}
                  />
                  <div
                    className="h-1.5 rounded w-1/2"
                    style={{ background: t.id === 'dark' ? '#1e1e1e' : '#f0f0f0' }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Saved in your browser — does not affect other users.
        </p>
      </section>

      {/* Demo data */}
      <section className="space-y-3">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--bo-accent)' }}
        >
          Demo data
        </h2>
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <p className="text-sm font-medium text-gray-900">Import sample data</p>
          <p className="text-xs text-gray-500 mt-1">
            Creates demo products, categories, brands, customers and orders. Useful if you skipped
            this during setup.
          </p>
          {seedStatus === 'done' && (
            <p className="mt-3 text-xs font-medium" style={{ color: '#4ade80' }}>
              Demo data imported successfully.
            </p>
          )}
          {seedStatus === 'error' && <p className="mt-3 text-xs text-red-400">{seedError}</p>}
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedStatus === 'loading' || seedStatus === 'done'}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
            style={{
              background: 'var(--bo-bg3)',
              border: '1px solid var(--bo-border2)',
              color: 'var(--bo-text)',
            }}
            onMouseEnter={(e) => {
              if (seedStatus !== 'loading' && seedStatus !== 'done')
                e.currentTarget.style.borderColor = 'var(--bo-accent)'
            }}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--bo-border2)')}
          >
            {seedStatus === 'loading'
              ? 'Importing…'
              : seedStatus === 'done'
                ? 'Imported'
                : 'Import demo data'}
          </button>
        </div>
      </section>

      <CurrencySection />
    </div>
  )
}

function CurrencySection() {
  const utils = trpc.useUtils()
  const { data: config, isLoading } = trpc.admin.currency.get.useQuery()
  const [rows, setRows] = useState<Array<{ code: string; rate: string }>>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!config) return
    setRows(Object.entries(config.rates).map(([code, rate]) => ({ code, rate: String(rate) })))
  }, [config])

  const setRatesMut = trpc.admin.currency.setRates.useMutation({
    onSuccess: () => {
      utils.admin.currency.get.invalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function updateRow(index: number, patch: Partial<{ code: string; rate: string }>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function handleSave() {
    const rates: Record<string, number> = {}
    for (const r of rows) {
      const code = r.code.trim().toUpperCase()
      const rate = Number.parseFloat(r.rate)
      if (code.length === 3 && rate > 0) rates[code] = rate
    }
    setRatesMut.mutate(rates)
  }

  return (
    <section className="space-y-3">
      <h2
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--bo-accent)' }}
      >
        Currencies
      </h2>
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--bo-muted)' }}>
          Base currency is <strong>{config?.base ?? '…'}</strong> (fixed by your store config).
          Add other currencies your storefront can display and charge in, with their rate relative
          to 1 unit of the base currency.
        </p>
        {isLoading ? (
          <p className="text-sm" style={{ color: 'var(--bo-muted)' }}>
            Loading…
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={`${row.code}-${i}`} className="flex items-center gap-2">
                <input
                  value={row.code}
                  onChange={(e) => updateRow(i, { code: e.target.value.toUpperCase() })}
                  maxLength={3}
                  placeholder="USD"
                  className="w-20 rounded-lg px-3 py-2 text-sm outline-none font-mono uppercase"
                  style={{
                    background: 'var(--bo-bg3)',
                    border: '1px solid var(--bo-border)',
                    color: 'var(--bo-text)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--bo-muted)' }}>
                  = 1 {config?.base}
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={row.rate}
                  onChange={(e) => updateRow(i, { rate: e.target.value })}
                  placeholder="1.08"
                  className="w-28 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bo-bg3)',
                    border: '1px solid var(--bo-border)',
                    color: 'var(--bo-text)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows([...rows, { code: '', rate: '' }])}
              className="text-xs"
              style={{ color: 'var(--bo-accent)' }}
            >
              + Add currency
            </button>
          </div>
        )}
        {setRatesMut.error && (
          <p className="text-xs text-red-400">{setRatesMut.error.message}</p>
        )}
        {saved && (
          <p className="text-xs font-medium" style={{ color: '#4ade80' }}>
            Saved.
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={setRatesMut.isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
          style={{
            background: 'var(--bo-bg3)',
            border: '1px solid var(--bo-border2)',
            color: 'var(--bo-text)',
          }}
        >
          {setRatesMut.isPending ? 'Saving…' : 'Save currencies'}
        </button>
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  configAnchor,
}: { label: string; value: string; configAnchor?: string }) {
  return (
    <div
      className="flex items-center px-5 py-4"
      style={{ borderBottom: '1px solid var(--bo-border)' }}
    >
      <span className="w-48 text-sm font-medium text-gray-600">{label}</span>
      <span className="flex-1 text-sm text-gray-900">{value}</span>
      {configAnchor && (
        <Link
          to={`/marketplace#category-${configAnchor}`}
          className="text-xs font-medium text-orange-500 hover:text-orange-700 transition-colors"
        >
          Configure →
        </Link>
      )}
    </div>
  )
}
