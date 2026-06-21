import { useState } from 'react'
import { Link } from 'react-router-dom'
import { trpc } from '../trpc.js'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const forgotMut = trpc.customers.forgotPassword.useMutation({
    onSuccess: () => setDone(true),
  })

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
          <p className="text-lg font-semibold text-green-800 mb-2">Check your inbox</p>
          <p className="text-sm text-green-700">
            If an account exists for <strong>{email}</strong>, a reset link has been sent. It
            expires in 1 hour.
          </p>
        </div>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm text-[var(--primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Forgot password?</h1>
      <p className="text-sm text-gray-500 mb-8">
        Enter your email and we'll send you a reset link.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          forgotMut.mutate({
            email,
            storeUrl: window.location.origin,
          })
        }}
        className="space-y-4"
      >
        {forgotMut.error && <p className="text-red-600 text-sm">{forgotMut.error.message}</p>}
        <div>
          <label htmlFor="f-16" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="f-16"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={forgotMut.isPending}
          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {forgotMut.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600 text-center">
        <Link to="/login" className="text-[var(--primary)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
