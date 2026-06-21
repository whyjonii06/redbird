/**
 * Money is always represented as an integer minor unit (cents for EUR/USD, etc.)
 * plus a 3-letter ISO 4217 currency code. Never use floats for money.
 */
export type Money = {
  readonly amount: number
  readonly currency: string
}

export function money(amount: number, currency: string): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money amount must be an integer (got ${amount})`)
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Money currency must be 3-letter ISO 4217 (got "${currency}")`)
  }
  return { amount, currency }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function multiplyMoney(m: Money, factor: number): Money {
  return money(Math.round(m.amount * factor), m.currency)
}

export function zeroMoney(currency: string): Money {
  return money(0, currency)
}

export function formatMoney(m: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
  }).format(m.amount / 100)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}
