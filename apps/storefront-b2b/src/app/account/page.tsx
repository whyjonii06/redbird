import { getT } from '@/i18n'
import { formatPriceCompact } from '@/lib/format'
import { trpc } from '@/lib/trpc'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; email?: string }>
}) {
  const t = await getT()
  const { order: orderNumber, email } = await searchParams
  let order = null
  let error: string | null = null
  if (orderNumber?.trim() && email?.trim()) {
    const found = await trpc.checkout.getByNumber
      .query({ number: orderNumber.trim() })
      .catch(() => null)
    if (found && found.customerEmail.toLowerCase() === email.trim().toLowerCase()) {
      order = found
    } else {
      error = t('account.notFound')
    }
  }

  const field =
    'w-full border border-line bg-white px-3 py-2 text-sm text-graphite outline-none focus:border-teal'
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate'

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:px-10">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-teal">
        {t('account.eyebrow')}
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-graphite">
        {t('account.title')}
      </h1>
      <p className="mb-8 text-sm text-slate">{t('account.intro')}</p>

      <form
        action="/account"
        className="grid gap-4 border border-line bg-surface p-5 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="order" className={label}>
            {t('account.orderNumber')}
          </label>
          <input
            id="order"
            name="order"
            defaultValue={orderNumber ?? ''}
            required
            className={field}
          />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            {t('account.email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email ?? ''}
            required
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-teal px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-teal-dark"
          >
            {t('account.search')}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {order && (
        <div className="mt-8 border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
            <span className="font-semibold text-graphite">
              {t('account.order')} {order.number}
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-teal">
              {t(`status.${order.status}`)}
            </span>
          </div>
          <dl className="mt-4 space-y-2 font-mono text-sm">
            {order.lineItems.map((li) => (
              <div key={li.id} className="flex justify-between">
                <dt className="text-slate">×{li.quantity}</dt>
                <dd className="text-graphite">
                  {formatPriceCompact(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex justify-between font-mono text-base font-semibold text-graphite">
            <span>{t('account.total')}</span>
            <span>{formatPriceCompact(order.totalAmount, order.currency)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
