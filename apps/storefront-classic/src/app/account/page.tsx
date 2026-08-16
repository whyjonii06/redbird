import { getT } from '@/i18n'
import { formatPrice } from '@/lib/format'
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
    'w-full border border-ink/15 bg-paper px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-copper'
  const label = 'mb-1 block text-xs uppercase tracking-widest text-ink-soft'

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 lg:px-10">
      <p className="mb-3 text-xs uppercase tracking-widest text-copper">{t('account.eyebrow')}</p>
      <h1 className="mb-3 font-display text-5xl font-medium tracking-tight text-ink">
        {t('account.title')}
      </h1>
      <p className="mb-10 text-lg text-ink-soft">{t('account.intro')}</p>

      <form action="/account" className="grid gap-5 sm:grid-cols-2">
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
            className="bg-ink px-8 py-3 text-sm uppercase tracking-widest text-paper transition-colors hover:bg-copper"
          >
            {t('account.search')}
          </button>
        </div>
      </form>

      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}

      {order && (
        <div className="mt-10 border border-ink/10 bg-paper p-6">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <span className="font-display text-lg text-ink">
              {t('account.order')} {order.number}
            </span>
            <span className="text-xs uppercase tracking-widest text-copper">
              {t(`status.${order.status}`)}
            </span>
          </div>
          <div className="mt-4 space-y-3 border-b border-ink/10 pb-4">
            {order.lineItems.map((li) => (
              <div key={li.id} className="flex justify-between text-sm text-ink">
                <span className="text-ink-soft">×{li.quantity}</span>
                <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between font-display text-lg text-ink">
            <span>{t('account.total')}</span>
            <span>{formatPrice(order.totalAmount, order.currency)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
