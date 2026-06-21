type Props = {
  label: string
  value: string | number
  sub?: string | undefined
}

export function StatCard({ label, value, sub }: Props) {
  return (
    <div className="bg-gray-100 border border-gray-200 border-l-2 border-l-indigo-600 p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
