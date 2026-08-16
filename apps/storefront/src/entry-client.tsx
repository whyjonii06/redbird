import type { DehydratedState } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.js'
import './index.css'
import type { StoreMeta } from './meta.js'
import { makeTRPCClient } from './trpc.js'

declare global {
  interface Window {
    __INITIAL_META__?: StoreMeta
    __REACT_QUERY_STATE__?: DehydratedState
  }
}

// Every route is now server-rendered (see entry-server.tsx), so the client
// always hydrates existing markup rather than mounting into an empty <div>.
// The embedded meta/query state make this first render match the server's
// exactly — matters even for a plain hydrate, since React diffs it anyway.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
const trpcClient = makeTRPCClient()
const initialMeta = window.__INITIAL_META__
const dehydratedState = window.__REACT_QUERY_STATE__

ReactDOM.hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <BrowserRouter>
      <App
        queryClient={queryClient}
        trpcClient={trpcClient}
        initialMeta={initialMeta}
        dehydratedState={dehydratedState}
      />
    </BrowserRouter>
  </StrictMode>,
)

// Registered post-load so it never delays first paint. Skipped outside
// production (Vite's dev server rewrites/HMR don't play well with an active
// service worker intercepting fetches) and outside secure contexts, since
// browsers refuse to register one there anyway.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a progressive enhancement — silently skip if it fails.
    })
  })
}
