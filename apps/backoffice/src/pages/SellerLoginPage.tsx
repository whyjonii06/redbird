import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setSellerToken } from '../auth.js'
import { trpc } from '../trpc.js'

export function SellerLoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')

  const loginMut = trpc.sellers.login.useMutation({
    onSuccess: (result) => {
      setSellerToken(result.token)
      navigate('/seller')
    },
  })
  const registerMut = trpc.sellers.register.useMutation({
    onSuccess: () => {
      setMode('login')
      setPassword('')
    },
  })

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-6">
          <p className="text-xl font-bold text-white">redbird</p>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Seller portal</p>
        </div>

        <div className="flex border-b border-gray-800 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 pb-2 text-sm font-medium ${
              mode === 'login' ? 'text-white border-b-2 border-red-500' : 'text-gray-500'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 pb-2 text-sm font-medium ${
              mode === 'register' ? 'text-white border-b-2 border-red-500' : 'text-gray-500'
            }`}
          >
            Become a seller
          </button>
        </div>

        {mode === 'login' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              loginMut.mutate({ email, password })
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="seller-email" className="block text-xs text-gray-400 mb-1">
                Email
              </label>
              <input
                id="seller-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="seller-password" className="block text-xs text-gray-400 mb-1">
                Password
              </label>
              <input
                id="seller-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            {loginMut.error && <p className="text-xs text-red-400">{loginMut.error.message}</p>}
            <button
              type="submit"
              disabled={loginMut.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {loginMut.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              registerMut.mutate({ email, password, storeName })
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="reg-store-name" className="block text-xs text-gray-400 mb-1">
                Store name
              </label>
              <input
                id="reg-store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs text-gray-400 mb-1">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs text-gray-400 mb-1">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            {registerMut.error && (
              <p className="text-xs text-red-400">{registerMut.error.message}</p>
            )}
            {registerMut.isSuccess && (
              <p className="text-xs text-green-400">
                Account created — a staff member needs to approve it before you can sign in.
              </p>
            )}
            <button
              type="submit"
              disabled={registerMut.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
            >
              {registerMut.isPending ? 'Submitting…' : 'Apply to sell'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
