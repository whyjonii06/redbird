import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { trpc } from '../trpc.js'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const resetMut = trpc.customers.resetPassword.useMutation({
    onSuccess: () => navigate('/login?reset=1'),
    onError: (err) => setError(err.message),
  })

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-500">Invalid reset link. Please request a new one.</p>
        <Link
          to="/forgot-password"
          className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    resetMut.mutate({ token, newPassword: password })
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">Set new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label htmlFor="f-21" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="f-21"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="f-22" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
          </label>
          <input
            id="f-22"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={resetMut.isPending}
          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {resetMut.isPending ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}
