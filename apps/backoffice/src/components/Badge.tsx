import { useI18n } from '../i18n/index.js'

const styles: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  paid: 'bg-blue-50 text-blue-700 ring-blue-200',
  fulfilled: 'bg-green-50 text-green-700 ring-green-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  refunded: 'bg-gray-100 text-gray-600 ring-gray-200',
  draft: 'bg-gray-100 text-gray-600 ring-gray-200',
  active: 'bg-green-50 text-green-700 ring-green-200',
  archived: 'bg-red-50 text-red-700 ring-red-200',
  percentage: 'bg-purple-50 text-purple-700 ring-purple-200',
  fixed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

type Props = { value: string }

export function Badge({ value }: Props) {
  const { t } = useI18n()
  const cls = styles[value] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
  const key = `status.${value}`
  const label = t(key)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label === key ? value : label}
    </span>
  )
}
