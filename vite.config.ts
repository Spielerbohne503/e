import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Local API during development is served by `wrangler pages dev`.
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
