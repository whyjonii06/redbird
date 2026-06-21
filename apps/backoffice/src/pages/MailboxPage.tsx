import { useState } from 'react'
import { trpc } from '../trpc.js'

export function MailboxPage() {
  const utils = trpc.useUtils()
  const { data: emails = [], isLoading } = trpc.admin.emails.list.useQuery(undefined, {
    refetchInterval: 3000,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: selected } = trpc.admin.emails.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  )
  const clearMut = trpc.admin.emails.clear.useMutation({
    onSuccess: () => {
      setSelectedId(null)
      void utils.admin.emails.list.invalidate()
    },
  })
  const testMut = trpc.admin.emails.sendTest.useMutation({
    onSuccess: () => void utils.admin.emails.list.invalidate(),
  })

  const header = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--bo-text)' }}>
          Mailbox
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bo-muted)' }}>
          Local email preview — dev only
        </p>
      </div>
      <button
        type="button"
        onClick={() => testMut.mutate()}
        disabled={testMut.isPending}
        className="text-xs px-3 py-2 rounded-lg font-medium transition-colors"
        style={{
          background: 'var(--bo-accent)',
          color: '#fff',
          border: 'none',
          cursor: testMut.isPending ? 'not-allowed' : 'pointer',
          opacity: testMut.isPending ? 0.7 : 1,
        }}
      >
        {testMut.isPending ? 'Sending…' : 'Send test email'}
      </button>
    </div>
  )

  if (!isLoading && emails.length === 0) {
    return (
      <div className="p-8 space-y-6">
        {header}
        {testMut.error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: 'rgba(232,48,42,0.06)',
              border: '1px solid rgba(232,48,42,0.2)',
              color: 'var(--bo-accent)',
            }}
          >
            {testMut.error.message}
          </div>
        )}
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bo-bg2)', border: '1px solid var(--bo-border)' }}
        >
          <p className="text-4xl mb-4">📭</p>
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--bo-text)' }}>
            No emails yet
          </p>
          <p className="text-sm" style={{ color: 'var(--bo-muted)' }}>
            Click <strong>Send test email</strong> above to capture your first email.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--bo-muted)', opacity: 0.6 }}>
            Emails sent by the store (order confirmations, etc.) appear here automatically.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bo-bg)' }}>
      {/* Top bar */}
      <div
        className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--bo-border)', background: 'var(--bo-bg2)' }}
      >
        <div>
          <h1 className="text-sm font-bold" style={{ color: 'var(--bo-text)' }}>
            Mailbox
          </h1>
          <p className="text-xs" style={{ color: 'var(--bo-muted)' }}>
            {emails.length} email{emails.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{
              background: 'var(--bo-accent)',
              color: '#fff',
              border: 'none',
              cursor: testMut.isPending ? 'not-allowed' : 'pointer',
              opacity: testMut.isPending ? 0.7 : 1,
            }}
          >
            {testMut.isPending ? 'Sending…' : 'Send test'}
          </button>
          <button
            type="button"
            onClick={() => clearMut.mutate()}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: 'var(--bo-bg3)',
              border: '1px solid var(--bo-border)',
              color: 'var(--bo-muted)',
              cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div
          className="w-80 flex-shrink-0 overflow-y-auto"
          style={{ borderRight: '1px solid var(--bo-border)', background: 'var(--bo-bg2)' }}
        >
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg animate-pulse"
                  style={{ background: 'var(--bo-bg3)' }}
                />
              ))}
            </div>
          ) : (
            emails.map((email) => (
              <button
                type="button"
                key={email.id}
                onClick={() => setSelectedId(email.id)}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  borderBottom: '1px solid var(--bo-border)',
                  background: selectedId === email.id ? 'rgba(232,48,42,0.06)' : 'transparent',
                  borderLeft:
                    selectedId === email.id
                      ? '2px solid var(--bo-accent)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <p className="text-xs font-medium truncate" style={{ color: 'var(--bo-text)' }}>
                  {email.subject}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--bo-muted)' }}>
                  To: {email.to}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--bo-muted)', opacity: 0.6 }}>
                  {new Date(email.sentAt).toLocaleTimeString()} —{' '}
                  {new Date(email.sentAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Email preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div
                className="px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--bo-border)', background: 'var(--bo-bg2)' }}
              >
                <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--bo-text)' }}>
                  {selected.subject}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--bo-muted)' }}>
                  <span className="mr-3">To: {selected.to}</span>
                  <span className="mr-3">From: {selected.from}</span>
                  <span>{new Date(selected.sentAt).toLocaleString()}</span>
                </p>
              </div>
              <div className="flex-1 overflow-hidden bg-white">
                <iframe
                  srcDoc={selected.html}
                  className="w-full h-full border-0"
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--bo-muted)' }}>
                Select an email to preview
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
