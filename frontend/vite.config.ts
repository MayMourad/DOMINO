import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The base path is configurable (GitHub Pages serves from /<repo>/), never hardcoded in the app.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    server: { port: 5173, fs: { allow: ['..'] }, proxy: { '/v1': 'http://127.0.0.1:8000' } },
    preview: { port: 4173, proxy: { '/v1': 'http://127.0.0.1:8000' } },
    build: { chunkSizeWarningLimit: 900 },
    test: { environment: 'jsdom', include: ['src/tests/**/*.test.{ts,tsx}'], globals: true },
  }
})
