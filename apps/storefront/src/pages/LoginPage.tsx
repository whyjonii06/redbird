import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext.js'
import { trpc } from '../trpc.js'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMut = trpc.customers.login.useMutation({
    onSuccess({ token, customer }) {
      login(token, customer)
      navigate('/account')
    },
    onError(err) {
      setError(err.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    loginMut.mutate({ email, password })
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={loginMut.isPending}
          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loginMut.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600 text-center">
        <Link to="/forgot-password" className="text-[var(--primary)] hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-3 text-sm text-gray-600 text-center">
        No account?{' '}
        <Link to="/register" className="text-[var(--primary)] hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}
