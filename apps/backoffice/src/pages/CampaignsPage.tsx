import { useState } from 'react'
import {
  ErrorAlert,
  btnLink,
  btnLinkDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  parseApiError,
} from '../components/ui.js'
import { trpc } from '../trpc.js'

type Campaign = {
  id: string
  subject: string
  html: string
  status: 'draft' | 'sending' | 'sent'
  audienceGroupId: string | null
  createdAt: string
  sentAt: string | null
  recipientCounts: { pending: number; sent: number; failed: number }
}

function CampaignForm({
  existing,
  onSuccess,
  onCancel,
}: { existing?: Campaign; onSuccess: () => void; onCancel: () => void }) {
  const { data: groups = [] } = trpc.admin.customerGroups.list.useQuery()
  const [subject, setSubject] = useState(existing?.subject ?? '')
  const [html, setHtml] = useState(existing?.html ?? '')
  const [audienceGroupId, setAudienceGroupId] = useState(existing?.audienceGroupId ?? '')
  const [error, setError] = useState('')

  const { data: audienceSize } = trpc.admin.campaigns.estimateAudience.useQuery({
    audienceGroupId: audienceGroupId || undefined,
  })

  const createMut = trpc.admin.campaigns.create.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })
  const updateMut = trpc.admin.campaigns.update.useMutation({
    onSuccess,
    onError: (e) => setError(parseApiError(e)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = { subject, html, audienceGroupId: audienceGroupId || undefined }
    if (existing) updateMut.mutate({ id: existing.id, ...input })
    else createMut.mutate(input)
  }

  const busy = createMut.isPending || updateMut.isPending

  return (
    <form onSubmit={handleSubmit} className="bg-indigo-50 border border-indigo-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm">
        {existing ? 'Edit campaign' : 'New campaign'}
      </h2>
      {error && <ErrorAlert message={error} />}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Subject *</label>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="20% off everything this weekend"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Audience</label>
        <select
          value={audienceGroupId}
          onChange={(e) => setAudienceGroupId(e.target.value)}
          className={inputCls}
        >
          <option value="">All opted-in customers</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} (opted-in members only)
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Reaches {audienceSize ?? '…'} customer{audienceSize === 1 ? '' : 's'} who opted in to
          marketing emails.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email content (HTML)</label>
        <textarea
          required
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={10}
          placeholder="<h1>Big sale!</h1><p>...</p>"
          className={`${inputCls} font-mono text-xs`}
        />
        <p className="text-xs text-gray-500 mt-1">
          An unsubscribe link is appended automatically — no need to include one.
        </p>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? 'Saving…' : existing ? 'Save' : 'Create draft'}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const STATUS_LABEL: Record<Campaign['status'], string> = {
  draft: 'Draft',
  sending: 'Sending…',
  sent: 'Sent',
}
const STATUS_CLASS: Record<Campaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const utils = trpc.useUtils()
  const [editing, setEditing] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)

  const sendMut = trpc.admin.campaigns.send.useMutation({
    onSuccess: (result) => {
      setSendResult(result)
      void utils.admin.campaigns.list.invalidate()
    },
  })
  const deleteMut = trpc.admin.campaigns.delete.useMutation({
    onSuccess: () => void utils.admin.campaigns.list.invalidate(),
  })

  if (editing) {
    return (
      <tr className="border-b border-gray-50">
        <td colSpan={5} className="px-5 py-3">
          <CampaignForm
            existing={campaign}
            onSuccess={() => {
              setEditing(false)
              void utils.admin.campaigns.list.invalidate()
            }}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-5 py-3.5 font-medium text-gray-900 max-w-xs truncate">
        {campaign.subject}
      </td>
      <td className="px-5 py-3.5">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[campaign.status]}`}
        >
          {STATUS_LABEL[campaign.status]}
        </span>
      </td>
      <td className="px-5 py-3.5 text-gray-600 text-xs">
        {campaign.status === 'draft' ? (
          '—'
        ) : (
          <>
            {campaign.recipientCounts.sent} sent
            {campaign.recipientCounts.failed > 0 && (
              <span className="text-red-500"> · {campaign.recipientCounts.failed} failed</span>
            )}
          </>
        )}
      </td>
      <td className="px-5 py-3.5 text-gray-400 text-xs">
        {campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : '—'}
      </td>
      <td className="px-5 py-3.5 text-right space-x-3">
        {campaign.status === 'draft' && (
          <>
            <button type="button" onClick={() => setEditing(true)} className={btnLink}>
              Edit
            </button>
            <button
              type="button"
              disabled={sendMut.isPending}
              onClick={() => {
                if (confirm(`Send "${campaign.subject}" now? This can't be undone.`)) {
                  sendMut.mutate({ id: campaign.id })
                }
              }}
              className={btnLink}
            >
              {sendMut.isPending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete draft "${campaign.subject}"?`)) {
                  deleteMut.mutate({ id: campaign.id })
                }
              }}
              className={btnLinkDanger}
            >
              Delete
            </button>
          </>
        )}
      </td>
      {sendResult && (
        <td colSpan={5} className="px-5 pb-3 text-xs text-green-700">
          Sent to {sendResult.sent} customer{sendResult.sent === 1 ? '' : 's'}
          {sendResult.failed > 0 && `, ${sendResult.failed} failed`}.
        </td>
      )}
    </tr>
  )
}

export function CampaignsPage() {
  const utils = trpc.useUtils()
  const { data: campaigns = [], isLoading } = trpc.admin.campaigns.list.useQuery()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Email campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Send a one-off marketing email to opted-in customers or a specific group.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
          + New campaign
        </button>
      </div>

      {showCreate && (
        <CampaignForm
          onSuccess={() => {
            setShowCreate(false)
            void utils.admin.campaigns.list.invalidate()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="bg-gray-100 border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No campaigns yet. Customers must opt in from their account page before they can be
            emailed.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Subject
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Results
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sent
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
