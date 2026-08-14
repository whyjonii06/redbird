import { createContext, useContext, useMemo, useState } from 'react'
import { trpc } from './trpc.js'

const CURRENCY_KEY = 'redbird_currency'

type CurrencyCtx = {
  /** Currency the customer wants to browse/buy in. Defaults to the store's base currency. */
  currency: string
  setCurrency: (code: string) => void
  /** Currencies the store has a configured rate for, including the base. */
  supported: string[]
  /** Convert a minor-unit amount from `from` into the selected currency. */
  convert: (amount: number, from: string) => number
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: 'EUR',
  setCurrency: () => {},
  supported: [],
  convert: (amount) => amount,
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: config } = trpc.currency.list.useQuery()
  const base = config?.base ?? 'EUR'

  const [stored, setStored] = useState<string | null>(() => localStorage.getItem(CURRENCY_KEY))
  const currency = stored ?? base

  function setCurrency(code: string) {
    localStorage.setItem(CURRENCY_KEY, code)
    setStored(code)
  }

  const supported = useMemo(
    () => [base, ...Object.keys(config?.rates ?? {})],
    [base, config?.rates],
  )

  function rateOf(code: string): number {
    if (code === base) return 1
    return config?.rates[code] ?? 1
  }

  function convert(amount: number, from: string): number {
    if (from === currency) return amount
    const inBase = amount / rateOf(from)
    return Math.round(inBase * rateOf(currency))
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, supported, convert }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
