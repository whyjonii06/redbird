import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.js'
import { trpc } from '../trpc.js'

type AddressForm = {
  label: string
  firstName: string
  lastName: string
  line1: string
  line2: string
  city: string
  postalCode: string
  countryCode: string
  phone: string
}

const EMPTY: AddressForm = {
  label: 'home',
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  countryCode: '',
  phone: '',
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent'

function AddressForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: AddressForm
  onSave: (f: AddressForm & { isDefault?: boolean }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<AddressForm>(initial)
  const [makeDefault, setMakeDefault] = useState(false)

  function set(field: keyof AddressForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, isDefault: makeDefault || undefined })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="f-6" className="block text-xs font-medium text-gray-600 mb-1">
            Label
          </label>
          <select id="f-6" value={form.label} onChange={set('label')} className={inputCls}>
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-7" className="block text-xs font-medium text-gray-600 mb-1">
            First name *
          </label>
          <input
            id="f-7"
            required
            value={form.firstName}
            onChange={set('firstName')}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="f-8" className="block text-xs font-medium text-gray-600 mb-1">
            Last name *
          </label>
          <input
            id="f-8"
            required
            value={form.lastName}
            onChange={set('lastName')}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label htmlFor="f-9" className="block text-xs font-medium text-gray-600 mb-1">
          Address line 1 *
        </label>
        <input id="f-9" required value={form.line1} onChange={set('line1')} className={inputCls} />
      </div>
      <div>
        <label htmlFor="f-10" className="block text-xs font-medium text-gray-600 mb-1">
          Address line 2 (optional)
        </label>
        <input id="f-10" value={form.line2} onChange={set('line2')} className={inputCls} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="f-11" className="block text-xs font-medium text-gray-600 mb-1">
            City *
          </label>
          <input id="f-11" required value={form.city} onChange={set('city')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-12" className="block text-xs font-medium text-gray-600 mb-1">
            Postal code *
          </label>
          <input
            id="f-12"
            required
            value={form.postalCode}
            onChange={set('postalCode')}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="f-13" className="block text-xs font-medium text-gray-600 mb-1">
            Country (ISO 2) *
          </label>
          <input
            id="f-13"
            required
            maxLength={2}
            value={form.countryCode}
            onChange={set('countryCode')}
            placeholder="FR"
            className={`${inputCls} uppercase`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="f-14" className="block text-xs font-medium text-gray-600 mb-1">
          Phone (optional)
        </label>
        <input
          id="f-14"
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          className={inputCls}
        />
      </div>
      <label
        htmlFor="f-15"
        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
      >
        <input
          id="f-15"
          type="checkbox"
          checked={makeDefault}
          onChange={(e) => setMakeDefault(e.target.checked)}
          className="rounded"
        />
        Set as default address
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[var(--primary)] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-300 px-5 py-2 rounded-lg text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function AddressBookPage() {
  const { customer } = useAuth()
  const utils = trpc.useUtils()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: addresses = [], isLoading } = trpc.addresses.list.useQuery()

  const createMut = trpc.addresses.create.useMutation({
    onSuccess() {
      void utils.addresses.list.invalidate()
      setShowForm(false)
    },
  })

  const updateMut = trpc.addresses.update.useMutation({
    onSuccess() {
      void utils.addresses.list.invalidate()
      setEditingId(null)
    },
  })

  const deleteMut = trpc.addresses.delete.useMutation({
    onSuccess() {
      void utils.addresses.list.invalidate()
    },
  })

  const setDefaultMut = trpc.addresses.setDefault.useMutation({
    onSuccess() {
      void utils.addresses.list.invalidate()
    },
  })

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">You need to sign in to manage your addresses.</p>
        <Link to="/login" className="bg-[var(--primary)] text-white px-6 py-2 rounded-lg">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/account" className="text-sm text-gray-500 hover:text-gray-800 mb-1 block">
            ← My account
          </Link>
          <h1 className="text-2xl font-bold">Address book</h1>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + Add address
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">New address</h2>
          <AddressForm
            initial={EMPTY}
            onSave={(f) => createMut.mutate(f)}
            onCancel={() => setShowForm(false)}
            isPending={createMut.isPending}
          />
          {createMut.error && (
            <p className="mt-3 text-sm text-red-600">{createMut.error.message}</p>
          )}
        </div>
      )}

      {/* Address list */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : addresses.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500 mb-4">No saved addresses yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[var(--primary)] text-sm font-medium hover:underline"
          >
            Add your first address
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white border border-gray-200 rounded-xl p-6">
              {editingId === addr.id ? (
                <>
                  <h2 className="font-semibold mb-4">Edit address</h2>
                  <AddressForm
                    initial={{
                      label: addr.label,
                      firstName: addr.firstName,
                      lastName: addr.lastName,
                      line1: addr.line1,
                      line2: addr.line2 ?? '',
                      city: addr.city,
                      postalCode: addr.postalCode,
                      countryCode: addr.countryCode,
                      phone: addr.phone ?? '',
                    }}
                    onSave={(f) => updateMut.mutate({ id: addr.id, ...f })}
                    onCancel={() => setEditingId(null)}
                    isPending={updateMut.isPending}
                  />
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {addr.firstName} {addr.lastName}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{addr.line1}</p>
                    {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
                    <p className="text-sm text-gray-600">
                      {addr.postalCode} {addr.city}
                    </p>
                    <p className="text-sm text-gray-600">{addr.countryCode}</p>
                    {addr.phone && <p className="text-sm text-gray-500 mt-0.5">{addr.phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingId(addr.id)}
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      Edit
                    </button>
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultMut.mutate({ id: addr.id })}
                        disabled={setDefaultMut.isPending}
                        className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
                      >
                        Set as default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this address?')) deleteMut.mutate({ id: addr.id })
                      }}
                      disabled={deleteMut.isPending}
                      className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
