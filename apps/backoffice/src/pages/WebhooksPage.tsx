import { useState } from 'react'
import {
  ErrorAlert,
  btnLink,
  btnPrimary,
  btnSecondary,
  btnSmDanger,
  btnSmSecondary,
  parseApiError,
} from '../components/ui.js'
import { trpc } from '../trpc.js'

const ALL_EVENTS = [
  'order.created',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
  'order.refunded',
  'cart.created',
  'cart.afterAddItem',
  'cart.cleared',
  'product.created',
  'product.updated',
  'product.deleted',
  'variant.created',
  'variant.updated',
  'category.created',
  'category.updated',
  'category.deleted',
]

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  )
}

function DeliveryDrawer({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const { data: deliveries = [], isLoading } = trpc.admin.webhooks.deliveries.useQuery({
    webhookId,
    limit: 50,
  })
  const redeliverMut = trpc.admin.webhooks.redeliver.useMutation()
  const utils = trpc.useUtils()

  function redeliver(deliveryId: string) {
    redeliverMut.mutate(
      { deliveryId },
      {
        onSuccess: () => utils.admin.webhooks.deliveries.invalidate({ webhookId }),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        className="w-[640px] bg-gray-100 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Delivery history</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoading && <p className="p-6 text-sm text-gray-500">Loading…</p>}
          {!isLoading && deliveries.length === 0 && (
            <p className="p-6 text-sm text-gray-500">No deliveries yet.</p>
          )}
          {deliveries.map((d) => (
            <div key={d.id} className="px-6 py-4 space-y-1">
              <div className="flex items-center gap-3">
                <StatusBadge status={d.status} />
                <span className="text-sm font-mono text-gray-700">{d.event}</span>
                {d.responseStatus && (
                  <span className="text-xs text-gray-400">HTTP {d.responseStatus}</span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
              {d.error && (
                <p className="text-xs text-red-600 font-mono bg-red-50 px-2 py-1 rounded">
                  {d.error}
                </p>
              )}
              {d.responseBody && (
                <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded truncate">
                  {d.responseBody}
                </p>
              )}
              {d.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => redeliver(d.id)}
                  disabled={redeliverMut.isPending}
                  className={btnLink}
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils()
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order.paid', 'order.created'])
  const [error, setError] = useState('')

  const createMut = trpc.admin.webhooks.create.useMutation({
    onSuccess: () => {
      utils.admin.webhooks.list.invalidate()
      onClose()
    },
    onError: (e) => setError(parseApiError(e)),
  })

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
  }

  function toggleAll() {
    setSelectedEvents((prev) => (prev.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url) return setError('URL is required')
    if (selectedEvents.length === 0) return setError('Select at least one event')
    createMut.mutate({
      url,
      events: selectedEvents,
      ...(description ? { description } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gray-100 border border-gray-200 w-full max-w-lg p-6 space-y-5"
      >
        <h2 className="font-semibold text-gray-900 text-lg">New webhook endpoint</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Endpoint URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.com/webhooks/redbird"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. ERP order sync"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Events</label>
            <button type="button" onClick={toggleAll} className={btnLink}>
              {selectedEvents.length === ALL_EVENTS.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border rounded-lg p-2">
            {ALL_EVENTS.map((event) => (
              <label
                key={event}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="accent-indigo-600"
                />
                <span className="text-xs font-mono text-gray-700">{event}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={createMut.isPending} className={btnPrimary}>
            {createMut.isPending ? 'Creating…' : 'Create webhook'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function WebhooksPage() {
  const utils = trpc.useUtils()
  const { data: webhooks = [], isLoading } = trpc.admin.webhooks.list.useQuery()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null)

  const toggleMut = trpc.admin.webhooks.update.useMutation({
    onSuccess: () => utils.admin.webhooks.list.invalidate(),
  })
  const deleteMut = trpc.admin.webhooks.delete.useMutation({
    onSuccess: () => utils.admin.webhooks.list.invalidate(),
  })

  function toggleActive(id: string, active: boolean) {
    toggleMut.mutate({ id, active: !active })
  }

  function deleteWebhook(id: string) {
    if (confirm('Delete this webhook endpoint?')) {
      deleteMut.mutate({ id })
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Forward events to external URLs with HMAC-SHA256 signatures.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
          + Add endpoint
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!isLoading && webhooks.length === 0 && (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-gray-500 text-sm">No webhook endpoints yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Add an endpoint to forward events to your ERP, WMS, or marketing tools.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map((wh) => (
          <div
            key={wh.id}
            className="bg-gray-100 border border-gray-200 p-5 flex items-start gap-4"
          >
            {/* Active toggle */}
            <button
              type="button"
              onClick={() => toggleActive(wh.id, wh.active)}
              className={`mt-0.5 w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                wh.active ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title={wh.active ? 'Active — click to disable' : 'Inactive — click to enable'}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-gray-100 shadow transition-transform mx-0.5 ${
                  wh.active ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-900 truncate">{wh.url}</span>
                {!wh.active && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                    disabled
                  </span>
                )}
              </div>
              {wh.description && <p className="text-xs text-gray-500 mb-2">{wh.description}</p>}
              <div className="flex flex-wrap gap-1">
                {wh.events.map((ev) => (
                  <span
                    key={ev}
                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded font-mono"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedWebhookId(wh.id)}
                className={btnSmSecondary}
              >
                History
              </button>
              <button type="button" onClick={() => deleteWebhook(wh.id)} className={btnSmDanger}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateForm onClose={() => setShowCreate(false)} />}
      {selectedWebhookId && (
        <DeliveryDrawer webhookId={selectedWebhookId} onClose={() => setSelectedWebhookId(null)} />
      )}
    </div>
  )
}
