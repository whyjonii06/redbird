import { useState } from 'react'
import { inputCls } from '../components/ui.js'
import { trpc } from '../trpc.js'

const ACTION_LABEL: Record<string, string> = {
  'order.cancel': 'Order cancelled',
  'order.refund': 'Order refunded',
  'order.refund_partial': 'Order partially refunded',
  'return.approve': 'Return approved',
  'return.reject': 'Return rejected',
  'staff.create': 'Staff member created',
  'staff.update': 'Staff member updated',
  'staff.delete': 'Staff member deleted',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')

  const { data: entries = [], isLoading } = trpc.admin.auditLog.list.useQuery({
    limit: 100,
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Who did what — staff and admin-key actions on orders, returns and team members.
        </p>
      </div>

      <div className="flex gap-3">
        <input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="Filter by entity type (order, staff, return_request…)"
          className={`${inputCls} max-w-xs`}
        />
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action (order.refund…)"
          className={`${inputCls} max-w-xs`}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="bg-gray-100 border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No matching audit entries.</p>
        </div>
      ) : (
        <div className="bg-gray-100 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  When
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Actor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Action
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Entity
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{entry.actorLabel}</span>
                    <span className="block text-xs text-gray-400">{entry.actorType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {entry.entityType}
                    {entry.entityId ? `#${entry.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-xs truncate">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
