import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { makeTRPCClient, trpc } from './trpc'

function Root() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() => makeTRPCClient())
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
