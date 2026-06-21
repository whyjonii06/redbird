import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAdminKey, setStaffSession } from '../auth.js'
import { trpc } from '../trpc.js'

type Mode = 'key' | 'staff'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('staff')
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bo-bg)' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: 'var(--bo-bg2)', border: '1px solid #1e1e1e' }}
      >
        <div className="text-center mb-8">
          <img
            src="/logo-redbird.svg"
            alt="Redbird"
            className="w-14 h-14 mx-auto mb-4 rounded-xl"
          />
          <p
            className="text-xs font-medium"
            style={{
              color: 'var(--bo-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}
          >
            Admin
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex mb-6" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <button
            type="button"
            onClick={() => setMode('staff')}
            className={`flex-1 pb-2.5 text-xs font-medium transition-colors -mb-px ${
              mode === 'staff' ? 'text-white' : 'hover:text-[#aaa]'
            }`}
            style={
              mode === 'staff'
                ? { borderBottom: '2px solid #E8302A', color: 'var(--bo-text)' }
                : { borderBottom: '2px solid transparent', color: 'var(--bo-muted)' }
            }
          >
            Staff login
          </button>
          <button
            type="button"
            onClick={() => setMode('key')}
            className={`flex-1 pb-2.5 text-xs font-medium transition-colors -mb-px`}
            style={
              mode === 'key'
                ? { borderBottom: '2px solid #E8302A', color: 'var(--bo-text)' }
                : { borderBottom: '2px solid transparent', color: 'var(--bo-muted)' }
            }
          >
            Master key
          </button>
        </div>

        {mode === 'staff' ? (
          <StaffLoginForm onSuccess={() => navigate('/', { replace: true })} />
        ) : (
          <AdminKeyForm onSuccess={() => navigate('/', { replace: true })} />
        )}
      </div>
    </div>
  )
}

function StaffLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMut = trpc.staff.login.useMutation({
    onSuccess({ token, staff }) {
      setStaffSession(token, staff.role)
      onSuccess()
    },
    onError(err) {
      setError(err.message)
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    loginMut.mutate({ email, password })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p
          className="text-xs text-red-400 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(232,48,42,0.1)', border: '1px solid rgba(232,48,42,0.2)' }}
        >
          {error}
        </p>
      )}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bo-muted)' }}>
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm outline-none rounded-lg transition-colors"
          style={{
            background: 'var(--bo-bg3)',
            border: '1px solid #2a2a2a',
            color: 'var(--bo-text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8302A')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bo-border2)')}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bo-muted)' }}>
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm outline-none rounded-lg transition-colors"
          style={{
            background: 'var(--bo-bg3)',
            border: '1px solid #2a2a2a',
            color: 'var(--bo-text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8302A')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bo-border2)')}
        />
      </div>
      <button
        type="submit"
        disabled={loginMut.isPending}
        className="w-full text-white font-semibold py-2.5 px-4 text-sm rounded-lg transition-all disabled:opacity-50 mt-2"
        style={{ background: '#E8302A', boxShadow: '0 0 20px rgba(232,48,42,0.25)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#b32420'
          e.currentTarget.style.boxShadow = '0 0 30px rgba(232,48,42,0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#E8302A'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(232,48,42,0.25)'
        }}
      >
        {loginMut.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function AdminKeyForm({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) {
      setError('Admin key is required')
      return
    }
    setAdminKey(key.trim())
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bo-muted)' }}>
          Admin key
        </label>
        <input
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setError('')
          }}
          placeholder="••••••••••••"
          className="w-full px-3.5 py-2.5 text-sm outline-none rounded-lg transition-colors"
          style={{
            background: 'var(--bo-bg3)',
            border: '1px solid #2a2a2a',
            color: 'var(--bo-text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#E8302A')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bo-border2)')}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
      <button
        type="submit"
        className="w-full text-white font-semibold py-2.5 px-4 text-sm rounded-lg transition-all mt-2"
        style={{ background: '#E8302A', boxShadow: '0 0 20px rgba(232,48,42,0.25)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#b32420'
          e.currentTarget.style.boxShadow = '0 0 30px rgba(232,48,42,0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#E8302A'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(232,48,42,0.25)'
        }}
      >
        Sign in
      </button>
    </form>
  )
}
