import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3004,
    proxy: {
      '/trpc': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
      '/setup': 'http://localhost:3000',
    },
  },
})
