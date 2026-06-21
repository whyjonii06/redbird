import { getT } from '@/i18n'
import { formatPrice } from '@/lib/format'
import { redbird } from '@/lib/redbird'

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
    const found = await redbird.orders.getByNumber(orderNumber.trim())
    if (found && found.customerEmail.toLowerCase() === email.trim().toLowerCase()) {
      order = found
    } else {
      error = t('account.notFound')
    }
  }

  const field =
    'w-full border border-ivory/20 bg-transparent px-4 py-3 text-sm text-ivory outline-none placeholder:text-ivory-muted focus:border-ruby'
  const label = 'mb-1 block text-[10px] uppercase tracking-[0.3em] text-ivory-muted'

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 lg:px-10">
      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-ruby">{t('account.eyebrow')}</p>
      <h1 className="mb-3 font-serif text-5xl text-ivory">{t('account.title')}</h1>
      <p className="mb-10 text-ivory-muted">{t('account.intro')}</p>

      <form action="/account" className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="order" className={label}>
            {t('account.orderNumber')}
          </label>
          <input id="order" name="order" defaultValue={orderNumber ?? ''} required className={field} />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            {t('account.email')}
          </label>
          <input id="email" name="email" type="email" defaultValue={email ?? ''} required className={field} />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-ruby px-8 py-3 text-xs uppercase tracking-[0.3em] text-ivory transition-colors hover:bg-saffron hover:text-coal"
          >
            {t('account.search')}
          </button>
        </div>
      </form>

      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

      {order && (
        <div className="mt-10 border-[3px] border-ivory p-6">
          <div className="flex items-center justify-between border-b border-ivory/20 pb-4">
            <span className="font-serif text-2xl text-ivory">
              {t('account.order')} {order.number}
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-ruby">
              {t(`status.${order.status}`)}
            </span>
          </div>
          <div className="mt-4 space-y-3 border-b border-ivory/20 pb-4">
            {order.lineItems.map((li) => (
              <div key={li.id} className="flex justify-between text-sm text-ivory">
                <span className="text-ivory-muted">×{li.quantity}</span>
                <span>{formatPrice(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-ivory-muted">
              {t('account.total')}
            </span>
            <span className="font-serif text-3xl text-ruby">
              {formatPrice(order.totalAmount, order.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
