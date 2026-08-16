const COUNTRIES: [string, string][] = [
  ['AF', 'Afghanistan'],
  ['AL', 'Albania'],
  ['DZ', 'Algeria'],
  ['AR', 'Argentina'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['BE', 'Belgium'],
  ['BR', 'Brazil'],
  ['CA', 'Canada'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['CO', 'Colombia'],
  ['HR', 'Croatia'],
  ['CZ', 'Czech Republic'],
  ['DK', 'Denmark'],
  ['EG', 'Egypt'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['GR', 'Greece'],
  ['HU', 'Hungary'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['IE', 'Ireland'],
  ['IL', 'Israel'],
  ['IT', 'Italy'],
  ['JP', 'Japan'],
  ['KE', 'Kenya'],
  ['MX', 'Mexico'],
  ['MA', 'Morocco'],
  ['NL', 'Netherlands'],
  ['NZ', 'New Zealand'],
  ['NG', 'Nigeria'],
  ['NO', 'Norway'],
  ['PK', 'Pakistan'],
  ['PE', 'Peru'],
  ['PH', 'Philippines'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['RO', 'Romania'],
  ['SA', 'Saudi Arabia'],
  ['ZA', 'South Africa'],
  ['KR', 'South Korea'],
  ['ES', 'Spain'],
  ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
  ['TW', 'Taiwan'],
  ['TH', 'Thailand'],
  ['TR', 'Turkey'],
  ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['VN', 'Vietnam'],
]

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMeta } from '../App.js'
import { useAuth } from '../AuthContext.js'
import { useCartContext, useCartData } from '../CartContext.js'
import { fmt, trpc } from '../trpc.js'

type Form = {
  email: string
  firstName: string
  lastName: string
  line1: string
  line2: string
  city: string
  postalCode: string
  countryCode: string
  phone: string
  vatNumber: string
}

const EMPTY: Form = {
  email: '',
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  countryCode: '',
  phone: '',
  vatNumber: '',
}

// ─── Step 1: Info form ───────────────────────────────────────────────────────

type OrderInfo = {
  orderId: string
  orderNumber: string
  clientSecret: string | null
  totalAmount: number
  currency: string
  poNumber: string | null
  dueDate: string | Date | null
}

function InfoStep({ onDone }: { onDone: (info: OrderInfo) => void }) {
  const { cartId } = useCartContext()
  const { data: cart } = useCartData()
  const { customer } = useAuth()
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState('')

  const { data: savedAddresses = [] } = trpc.addresses.list.useQuery(undefined, {
    enabled: !!customer,
  })

  const { data: paymentTerms } = trpc.customerGroups.myPaymentTerms.useQuery(undefined, {
    enabled: !!customer,
  })
  const [payByPo, setPayByPo] = useState(false)
  const [poNumber, setPoNumber] = useState('')

  const createOrder = trpc.checkout.createOrder.useMutation()
  const initiatePayment = trpc.checkout.initiatePayment.useMutation()

  function set(field: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  const subtotal =
    cart?.lineItems.reduce((sum, li) => sum + li.unitPriceAmount * li.quantity, 0) ?? 0
  const currency = cart?.currency ?? 'USD'

  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState('')
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState('')
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [giftCardInput, setGiftCardInput] = useState('')
  const [appliedGiftCard, setAppliedGiftCard] = useState('')

  const { data: loyaltyAccount } = trpc.loyalty.myAccount.useQuery(undefined, {
    enabled: !!customer,
  })

  const { data: shippingPreview } = trpc.checkout.previewShipping.useQuery(
    {
      cartId: cartId!,
      countryCode: form.countryCode.toUpperCase().slice(0, 2),
    },
    { enabled: !!cartId && form.countryCode.length >= 2 },
  )

  const { data: promoValidation, isFetching: promoChecking } = trpc.checkout.validatePromo.useQuery(
    {
      code: appliedPromo,
      subtotalCents: subtotal,
      lineItems: cart?.lineItems.map((li) => ({
        unitPriceAmount: li.unitPriceAmount,
        quantity: li.quantity,
      })),
    },
    { enabled: appliedPromo.length > 0 && subtotal > 0 },
  )

  const { data: giftCardValidation, isFetching: giftCardChecking } =
    trpc.checkout.validateGiftCard.useQuery(
      { code: appliedGiftCard, currency },
      { enabled: appliedGiftCard.length > 0 },
    )

  // Mirrors the server's discount stacking (checkout.createOrder) so the tax preview — and
  // the total shown before payment — reflect gift cards and loyalty points too, instead of
  // only the promo code. Without this the total on screen doesn't match what order
  // confirmation actually charges once those are applied.
  const loyaltyDiscountAmount = loyaltyAccount ? loyaltyPointsToRedeem * loyaltyAccount.redeemRate : 0
  const promoDiscountAmount = promoValidation?.valid ? promoValidation.discountAmount : 0
  const previewShippingAmount = shippingPreview && !shippingPreview.free ? shippingPreview.amount : 0
  const giftCardDiscountAmount = giftCardValidation?.valid
    ? Math.min(
        giftCardValidation.balance,
        Math.max(0, subtotal + previewShippingAmount - loyaltyDiscountAmount - promoDiscountAmount),
      )
    : 0
  const totalDiscountAmount = loyaltyDiscountAmount + promoDiscountAmount + giftCardDiscountAmount

  const { data: taxPreview } = trpc.checkout.previewTax.useQuery(
    {
      subtotalCents: Math.max(0, subtotal - totalDiscountAmount),
      countryCode: form.countryCode.toUpperCase().slice(0, 2),
      vatNumber: form.vatNumber || undefined,
    },
    { enabled: form.countryCode.length >= 2 && subtotal > 0 },
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      // shippingAmount/taxAmount are no longer sent — the server recomputes both from the
      // destination address (previewShipping/previewTax above are display-only estimates).
      const order = await createOrder.mutateAsync({
        cartId: cartId!,
        customerEmail: form.email,
        shippingAddress: {
          firstName: form.firstName,
          lastName: form.lastName,
          line1: form.line1,
          ...(form.line2 ? { line2: form.line2 } : {}),
          city: form.city,
          postalCode: form.postalCode,
          countryCode: form.countryCode.toUpperCase().slice(0, 2),
          ...(form.phone ? { phone: form.phone } : {}),
        },
        ...(form.vatNumber ? { vatNumber: form.vatNumber } : {}),
        ...(appliedPromo && promoValidation?.valid ? { promoCode: appliedPromo } : {}),
        ...(loyaltyPointsToRedeem > 0 ? { loyaltyPointsToRedeem } : {}),
        ...(appliedGiftCard && giftCardValidation?.valid ? { giftCardCode: appliedGiftCard } : {}),
        ...(payByPo && poNumber ? { poNumber: poNumber.trim() } : {}),
      })

      // Purchase-order orders are never charged to a card — the invoice is due on
      // the terms date and payment arrives out of band (bank transfer).
      let clientSecret: string | null = null
      if (!(payByPo && poNumber)) {
        try {
          const intent = await initiatePayment.mutateAsync({ orderId: order.id })
          clientSecret = intent.clientSecret
        } catch {
          // No payment provider configured — order placed directly
        }
      }

      onDone({
        orderId: order.id,
        orderNumber: order.number,
        clientSecret,
        totalAmount: order.totalAmount,
        currency: order.currency,
        poNumber: order.poNumber,
        dueDate: order.dueDate,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isLoading = createOrder.isPending || initiatePayment.isPending

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Contact
          </h2>
          <Field label="Email address" required>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>
        </section>

        {savedAddresses.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Saved addresses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      firstName: addr.firstName,
                      lastName: addr.lastName,
                      line1: addr.line1,
                      line2: addr.line2 ?? '',
                      city: addr.city,
                      postalCode: addr.postalCode,
                      countryCode: addr.countryCode,
                      phone: addr.phone ?? '',
                    }))
                  }
                  className="text-left p-3 rounded-xl border border-gray-200 hover:border-[var(--primary)] transition-colors text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {addr.firstName} {addr.lastName}
                  </span>
                  {addr.isDefault && (
                    <span className="ml-2 text-xs text-green-600 font-medium">Default</span>
                  )}
                  <p className="text-gray-500 mt-0.5 text-xs">
                    {addr.line1}, {addr.postalCode} {addr.city}, {addr.countryCode}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Shipping address
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required>
              <input
                type="text"
                required
                autoComplete="given-name"
                value={form.firstName}
                onChange={set('firstName')}
                className={inputCls}
              />
            </Field>
            <Field label="Last name" required>
              <input
                type="text"
                required
                autoComplete="family-name"
                value={form.lastName}
                onChange={set('lastName')}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Address line 1" required>
              <input
                type="text"
                required
                autoComplete="address-line1"
                value={form.line1}
                onChange={set('line1')}
                placeholder="12 rue de la Paix"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Address line 2 (optional)">
              <input
                type="text"
                autoComplete="address-line2"
                value={form.line2}
                onChange={set('line2')}
                placeholder="Apt, suite, etc."
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="City" required>
              <input
                type="text"
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={set('city')}
                className={inputCls}
              />
            </Field>
            <Field label="Postal code" required>
              <input
                type="text"
                required
                autoComplete="postal-code"
                value={form.postalCode}
                onChange={set('postalCode')}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Country" required>
              <select
                required
                autoComplete="country"
                value={form.countryCode}
                onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                className={inputCls}
              >
                <option value="">Select a country…</option>
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone (optional)">
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+33 6 12 34 56 78"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="VAT number (optional, B2B)">
              <input
                type="text"
                autoComplete="off"
                value={form.vatNumber}
                onChange={set('vatNumber')}
                placeholder="FR12345678901"
                className={`${inputCls} uppercase`}
              />
            </Field>
          </div>
        </section>

        {paymentTerms?.termsDays && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Payment
            </h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={payByPo}
                onChange={(e) => setPayByPo(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                Pay by purchase order —{' '}
                <span className="font-medium">Net {paymentTerms.termsDays}</span>. Your account is
                eligible for invoiced payment; the total will be due {paymentTerms.termsDays} days
                after the order is placed instead of being charged now.
              </span>
            </label>
            {payByPo && (
              <div className="mt-3">
                <Field label="Purchase order number" required>
                  <input
                    type="text"
                    required={payByPo}
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO-2026-0142"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </section>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
      </div>

      <div className="lg:col-span-2">
        <OrderSummary
          subtotal={subtotal}
          currency={currency}
          taxPreview={taxPreview ?? null}
          discountAmount={totalDiscountAmount}
          shippingPreview={shippingPreview ?? null}
        >
          {/* Promo code */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase"
              />
              <button
                type="button"
                disabled={promoChecking || !promoInput}
                onClick={() => setAppliedPromo(promoInput.trim())}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {promoChecking ? '…' : 'Apply'}
              </button>
            </div>
            {appliedPromo && promoValidation && !promoValidation.valid && (
              <p className="mt-1.5 text-xs text-red-500">
                {promoValidation.reason === 'not_found' && 'Code not found'}
                {promoValidation.reason === 'inactive' && 'Code is inactive'}
                {promoValidation.reason === 'expired' && 'Code has expired'}
                {promoValidation.reason === 'max_uses_reached' && 'Code has reached its limit'}
                {promoValidation.reason === 'minimum_not_met' && 'Minimum order amount not reached'}
              </p>
            )}
          </div>
          {/* Gift card */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <input
                value={giftCardInput}
                onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                placeholder="Gift card code"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase font-mono"
              />
              <button
                type="button"
                disabled={giftCardChecking || !giftCardInput}
                onClick={() => setAppliedGiftCard(giftCardInput.trim())}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {giftCardChecking ? '…' : 'Apply'}
              </button>
            </div>
            {appliedGiftCard &&
              giftCardValidation &&
              (giftCardValidation.valid ? (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                  <span className="text-sm text-green-800">
                    Gift card · {fmt(giftCardValidation.balance, currency)} available
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedGiftCard('')
                      setGiftCardInput('')
                    }}
                    className="text-xs text-green-700 hover:text-green-900 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-red-500">
                  {giftCardValidation.reason === 'not_found' && 'Gift card not found'}
                  {giftCardValidation.reason === 'expired' && 'Gift card has expired'}
                  {giftCardValidation.reason === 'empty' && 'Gift card has no remaining balance'}
                  {giftCardValidation.reason === 'currency_mismatch' &&
                    'Gift card currency does not match'}
                </p>
              ))}
          </div>
          {/* Loyalty points */}
          {loyaltyAccount && loyaltyAccount.enabled && loyaltyAccount.balance > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Loyalty points — {loyaltyAccount.balance} available
              </p>
              {loyaltyPointsToRedeem > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-sm text-amber-800">
                    −{loyaltyPointsToRedeem} pts (−
                    {fmt(loyaltyAccount.redeemRate * loyaltyPointsToRedeem, 'EUR')})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoyaltyPointsToRedeem(0)
                      setLoyaltyPointsInput('')
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max={loyaltyAccount.balance}
                    value={loyaltyPointsInput}
                    onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                    placeholder={`Max ${loyaltyAccount.balance}`}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = Math.min(
                        Number.parseInt(loyaltyPointsInput, 10) || 0,
                        loyaltyAccount.balance,
                      )
                      if (n > 0) setLoyaltyPointsToRedeem(n)
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50"
                  >
                    Use
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-3.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {isLoading && <Spinner />}
            {payByPo ? 'Place order' : 'Continue to payment'}
          </button>
        </OrderSummary>
      </div>
    </form>
  )
}

// ─── Step 2: Stripe payment ───────────────────────────────────────────────────

function StripePaymentStep({ info, onSuccess }: { info: OrderInfo; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError('')
    setProcessing(true)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/order/${info.orderNumber}` },
      redirect: 'if_required',
    })
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={(e) => void handlePay(e)} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Payment
          </h2>
          <PaymentElement />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </section>
      </div>

      <div className="lg:col-span-2">
        <OrderSummary subtotal={info.totalAmount} currency={info.currency}>
          <button
            type="submit"
            disabled={!stripe || processing}
            className="w-full mt-6 py-3.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {processing && <Spinner />}
            {processing ? 'Processing…' : `Pay ${fmt(info.totalAmount, info.currency)}`}
          </button>
        </OrderSummary>
      </div>
    </form>
  )
}

// ─── No-payment fallback (no Stripe configured) ───────────────────────────────

function NoPaymentStep({ info, onSuccess }: { info: OrderInfo; onSuccess: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
        <p className="text-lg font-semibold text-green-800 mb-2">Order placed!</p>
        <p className="text-sm text-green-700 mb-6">
          Order #{info.orderNumber} has been created. No online payment is configured — the merchant
          will contact you.
        </p>
        <button
          type="button"
          onClick={onSuccess}
          className="bg-[var(--primary)] text-white px-6 py-3 rounded-xl font-medium"
        >
          View order
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckoutPage() {
  const meta = useMeta()
  const navigate = useNavigate()
  const { cartId, clearCart } = useCartContext()
  const { data: cart } = useCartData()
  const [step, setStep] = useState<'info' | 'payment'>('info')
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)

  const stripePromise = useMemo(
    () => (meta.stripePublicKey ? loadStripe(meta.stripePublicKey) : null),
    [meta.stripePublicKey],
  )

  if (!cartId || !cart || cart.lineItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link
          to="/products"
          style={{ color: 'var(--primary)' }}
          className="text-sm font-medium hover:underline"
        >
          Browse products →
        </Link>
      </div>
    )
  }

  function handleInfoDone(info: OrderInfo) {
    setOrderInfo(info)
    if (info.clientSecret) {
      setStep('payment')
    } else {
      // No payment provider — order is placed, go to confirm
      clearCart()
      navigate(`/order/${info.orderNumber}`)
    }
  }

  function handlePaymentSuccess() {
    clearCart()
    navigate(`/order/${orderInfo?.orderNumber}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        <div className="flex items-center gap-2 ml-auto text-sm">
          <StepDot active={step === 'info'} done={step === 'payment'} label="Information" />
          <div className="w-8 h-px bg-gray-200" />
          <StepDot active={step === 'payment'} done={false} label="Payment" />
        </div>
      </div>

      {step === 'info' && <InfoStep onDone={handleInfoDone} />}

      {step === 'payment' &&
        orderInfo &&
        (orderInfo.clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: orderInfo.clientSecret, appearance: { theme: 'stripe' } }}
          >
            <StripePaymentStep info={orderInfo} onSuccess={handlePaymentSuccess} />
          </Elements>
        ) : (
          <NoPaymentStep info={orderInfo} onSuccess={handlePaymentSuccess} />
        ))}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]'

function Field({
  label,
  required,
  children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

type TaxPreview = {
  taxAmount: number
  rate: number
  rateType: string
  reverseCharge: boolean
} | null
type ShippingPreview = {
  zone: string | null
  amount: number
  currency: string
  free: boolean
  reason?: string
} | null

function OrderSummary({
  subtotal,
  currency,
  taxPreview,
  discountAmount = 0,
  shippingPreview,
  children,
}: {
  subtotal: number
  currency: string
  taxPreview?: TaxPreview
  discountAmount?: number
  shippingPreview?: ShippingPreview
  children?: React.ReactNode
}) {
  const meta = useMeta()
  const { data: cart } = useCartData()
  const taxAmount = taxPreview?.taxAmount ?? 0
  const shippingAmount = shippingPreview && !shippingPreview.free ? shippingPreview.amount : 0
  const total = Math.max(0, subtotal + taxAmount + shippingAmount - discountAmount)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Order summary
      </h2>
      {cart && (
        <div className="space-y-3 mb-4">
          {cart.lineItems.map((li) => (
            <div key={li.id} className="flex justify-between text-sm">
              <span className="text-gray-600 truncate pr-2">
                {li.productName}
                {li.variantName ? ` — ${li.variantName}` : ''} × {li.quantity}
              </span>
              <span className="font-medium text-gray-900 shrink-0">
                {fmt(li.unitPriceAmount * li.quantity, li.unitPriceCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span>
            <span>−{fmt(discountAmount, currency)}</span>
          </div>
        )}
        {shippingPreview && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Shipping{shippingPreview.zone ? ` (${shippingPreview.zone})` : ''}</span>
            <span>
              {shippingPreview.free
                ? 'Free'
                : fmt(shippingPreview.amount, shippingPreview.currency)}
            </span>
          </div>
        )}
        {taxPreview && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              {taxPreview.reverseCharge
                ? 'VAT (reverse charge)'
                : `VAT (${Math.round(taxPreview.rate * 100)}%)`}
            </span>
            <span>{taxPreview.reverseCharge ? fmt(0, currency) : fmt(taxAmount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1">
          <span className="font-semibold text-gray-900">Total</span>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-lg">{fmt(total, currency)}</span>
            {meta.priceDisplay !== 'none' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {meta.priceDisplay === 'incl_tax' ? 'Tax incl.' : 'Excl. tax'}
              </p>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-[var(--primary)]' : done ? 'text-green-600' : 'text-gray-400'}`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-[var(--primary)] text-white' : done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
      >
        {done ? '✓' : active ? '●' : '○'}
      </span>
      {label}
    </span>
  )
}

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  )
}
