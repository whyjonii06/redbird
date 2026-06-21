import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Redbird, WebhookHandler } from '@redbirdshop/core'

const PAYMENT_CONFIRMED_EVENTS = new Set([
  'payment_intent.succeeded',
  'CHECKOUT.ORDER.COMPLETED',
  'PAYMENT.CAPTURE.COMPLETED',
])

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function buildWebhookHandlerMap(redbird: Redbird): Map<string, WebhookHandler> {
  const map = new Map<string, WebhookHandler>()
  for (const provider of redbird.payments.list()) {
    if (provider.webhookHandler) {
      map.set(provider.webhookHandler.path, provider.webhookHandler)
    }
  }
  return map
}

export async function handleWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
  handlers: Map<string, WebhookHandler>,
  redbird: Redbird,
): Promise<void> {
  const path = req.url ?? ''
  const handler = handlers.get(path)
  if (!handler) {
    jsonResponse(res, 404, { error: 'No webhook handler for this path' })
    return
  }

  let rawBody: Buffer
  try {
    rawBody = await readRawBody(req)
  } catch {
    jsonResponse(res, 400, { error: 'Failed to read request body' })
    return
  }

  const headers = req.headers as Record<string, string | string[] | undefined>

  let event: Awaited<ReturnType<typeof handler.handle>>
  try {
    event = await handler.handle(rawBody, headers)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    jsonResponse(res, 400, { error: message })
    return
  }

  if (PAYMENT_CONFIRMED_EVENTS.has(event.type) && event.orderId) {
    try {
      await redbird.orders.markPaid(event.orderId)
    } catch (err) {
      // Order may already be paid or not found — log and continue
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[webhook] markPaid failed for order ${event.orderId}: ${message}`)
    }
  }

  jsonResponse(res, 200, { received: true, type: event.type })
}
