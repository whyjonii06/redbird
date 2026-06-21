import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkoutRouter } from './routes/checkout.js'
import { licensesRouter } from './routes/licenses.js'
import { webhooksRouter } from './routes/webhooks.js'

const app = new Hono()

app.use('*', cors({ origin: '*' }))

app.get('/health', (c) => c.json({ ok: true, service: 'redbird-license-server' }))
app.route('/v1/checkout', checkoutRouter)
app.route('/v1/licenses', licensesRouter)
app.route('/v1/webhooks', webhooksRouter)

const PORT = parseInt(process.env['PORT'] ?? '4000', 10)
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Redbird license server running on port ${PORT}`)
})

export default app
