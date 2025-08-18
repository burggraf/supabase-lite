import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createApiPlugin } from './src/vite-api-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
    force: true,
  },
  worker: {
    format: 'es',
  },
  define: {
    global: 'globalThis',
  },
  esbuild: {
    target: 'esnext'
  },
  build: {
    target: 'esnext',
  },
  server: {
    fs: {
      strict: false
    }
  }
})
