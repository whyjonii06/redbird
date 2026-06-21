import { useState } from 'react'
import { useI18n } from '../i18n/index.js'
import {
  ErrorAlert,
  btnLinkDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  parseApiError,
} from '../components/ui.js'
import { trpc } from '../trpc.js'

const ROLE_LABELS: Record<string, { label: string; cls: string; desc: string }> = {
  owner: {
    label: 'Owner',
    cls: 'bg-purple-100 text-purple-700',
    desc: 'Full access + manage staff',
  },
  admin: {
    label: 'Admin',
    cls: 'bg-indigo-100 text-indigo-700',
    desc: 'Full access, no staff management',
  },
  warehouse: {
    label: 'Warehouse',
    cls: 'bg-amber-100 text-amber-700',
    desc: 'Orders, stock, returns',
  },
  support: {
    label: 'Support',
    cls: 'bg-gray-100 text-gray-600',
    desc: 'View orders and customers',
  },
}

export function StaffPage() {
  const { t } = useI18n()
  const utils = trpc.useUtils()
  const [showCreate, setShowCreate] = useState(false)

  const { data: members, isLoading } = trpc.staff.list.useQuery()
  const updateMut = trpc.staff.update.useMutation({
    onSuccess: () => void utils.staff.list.invalidate(),
  })
  const deleteMut = trpc.staff.delete.useMutation({
    onSuccess: () => void utils.staff.list.invalidate(),
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('staff.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('staff.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
          + Invite staff
        </button>
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([role, info]) => (
          <div key={role} className="bg-gray-100 border border-gray-200 p-4">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.cls}`}>
              {info.label}
            </span>
            <p className="text-xs text-gray-500 mt-2">{info.desc}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateStaffForm
          onSuccess={() => {
            setShowCreate(false)
            void utils.staff.list.invalidate()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">{t('common.loading')}</div>
        ) : !members?.length ? (
          <div className="p-12 text-center text-gray-400">{t('staff.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Member
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">
                      {[m.firstName, m.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateMut.mutate({
                          id: m.id,
                          role: e.target.value as 'owner' | 'admin' | 'warehouse' | 'support',
                        })
                      }
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="support">Support</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                    >
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => updateMut.mutate({ id: m.id, active: !m.active })}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {m.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Permanently delete "${m.email}"? This cannot be undone.`))
                            deleteMut.mutate({ id: m.id })
                        }}
                        className={btnLinkDanger}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function CreateStaffForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'support' as 'owner' | 'admin' | 'warehouse' | 'support',
  })
  const [error, setError] = useState('')

  const createMut = trpc.staff.create.useMutation({
    onSuccess,
    onError(err) {
      setError(parseApiError(err))
    },
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Invite a staff member</h2>
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
          <input value={form.firstName} onChange={set('firstName')} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
          <input value={form.lastName} onChange={set('lastName')} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Temporary password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
          <select value={form.role} onChange={set('role')} className={inputCls}>
            <option value="support">Support</option>
            <option value="warehouse">Warehouse</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() =>
            createMut.mutate({
              ...form,
              firstName: form.firstName || undefined,
              lastName: form.lastName || undefined,
            })
          }
          disabled={createMut.isPending}
          className={btnPrimary}
        >
          {createMut.isPending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  )
}
