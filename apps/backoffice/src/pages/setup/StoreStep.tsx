import type { SetupData } from './types.js'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK']

type Props = {
  data: SetupData
  onChange: (patch: Partial<SetupData>) => void
  onNext: () => void
}

export function StoreStep({ data, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-gray-900">Your store</h2>
        <p className="text-sm text-gray-500 mt-1">The basics — name and currency</p>
      </div>

      <div>
        <label className={labelCls}>Store name</label>
        <input
          value={data.storeName}
          onChange={(e) => onChange({ storeName: e.target.value })}
          placeholder="My Awesome Store"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Default currency</label>
        <div className="grid grid-cols-5 gap-2 mt-1.5">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ currency: c })}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                data.currency === c
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Btn onClick={onNext} disabled={!data.storeName.trim()}>
        Continue →
      </Btn>
    </div>
  )
}

const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'
const inputCls =
  'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

function Btn({
  children,
  onClick,
  disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
    >
      {children}
    </button>
  )
}
