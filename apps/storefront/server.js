// Vite's standard SSR server pattern: one file, dev uses Vite in middleware
// mode (transforms + ssrLoadModule on every request, full HMR), production
// imports the pre-built server bundle and serves the pre-built client assets.
// See https://vitejs.dev/guide/ssr — this mirrors that guide directly rather
// than reaching for a framework, since the app doesn't need one otherwise.
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 5173
// Absolute — a server-side fetch has no browser location/proxy to resolve a
// relative URL against, unlike the client (see trpc.ts's apiBase comment).
const apiBaseUrl = process.env.VITE_API_URL || 'http://localhost:3000'

const templateHtml = isProduction
  ? await fs.readFile(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8')
  : ''

const server = http.createServer((req, res) => {
  handleIncoming(req, res).catch((err) => {
    vite?.ssrFixStacktrace(err instanceof Error ? err : new Error(String(err)))
    console.error(err)
    res.statusCode = 500
    res.end(err instanceof Error ? err.stack : String(err))
  })
})

// HMR's websocket attaches to this same server/port, matching how the app
// was reached in dev before (one origin, no separate HMR port to configure).
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (!isProduction) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'custom',
  })
}

async function handleIncoming(req, res) {
  const url = req.url ?? '/'

  if (vite) {
    // Vite's own middleware serves /src/*, transformed assets, and the
    // /trpc, /meta.json, /manifest.webmanifest proxies from vite.config.ts —
    // it calls next() itself (invoking renderPage) when nothing else matches.
    vite.middlewares(req, res, () => void renderPage(res, url))
    return
  }

  if (await serveStatic(res, url)) return
  await renderPage(res, url)
}

async function renderPage(res, url) {
  let template
  let render

  if (vite) {
    template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
    template = await vite.transformIndexHtml(url, template)
    const mod = await vite.ssrLoadModule('/src/entry-server.tsx')
    render = mod.render
  } else {
    template = templateHtml
    const mod = await import('./dist/server/entry-server.js')
    render = mod.render
  }

  const { html, headHtml } = await render(url, { apiBaseUrl })

  const page = template.replace('<!--app-head-->', headHtml).replace('<!--app-html-->', html)

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(page)
}

/** Serves a built asset from dist/client if the path matches one. Returns whether it handled the request. */
async function serveStatic(res, url) {
  const pathname = url.split('?')[0] ?? url
  if (pathname === '/' || !pathname.includes('.')) return false
  const filePath = path.join(__dirname, 'dist/client', pathname)
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) return false
    res.writeHead(200, { 'Cache-Control': 'public, max-age=31536000, immutable' })
    res.end(await fs.readFile(filePath))
    return true
  } catch {
    return false
  }
}

server.listen(port, () => {
  console.log(`Storefront (SSR) → http://localhost:${port}`)
})
