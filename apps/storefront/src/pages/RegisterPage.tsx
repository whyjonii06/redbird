import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext.js'
import { trpc } from '../trpc.js'

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')

  const registerMut = trpc.customers.register.useMutation({
    onSuccess({ token, customer }) {
      login(token, customer)
      navigate('/account')
    },
    onError(err) {
      setError(err.message)
    },
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    registerMut.mutate({
      email: form.email,
      password: form.password,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
    })
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">Create account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-17" className="block text-sm font-medium text-gray-700 mb-1">
              First name
            </label>
            <input
              id="f-17"
              value={form.firstName}
              onChange={set('firstName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label htmlFor="f-18" className="block text-sm font-medium text-gray-700 mb-1">
              Last name
            </label>
            <input
              id="f-18"
              value={form.lastName}
              onChange={set('lastName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
        <div>
          <label htmlFor="f-19" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="f-19"
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label htmlFor="f-20" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="f-20"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
        </div>
        <button
          type="submit"
          disabled={registerMut.isPending}
          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {registerMut.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
