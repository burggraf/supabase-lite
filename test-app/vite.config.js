import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3001,
    host: true
  },
  build: {
    target: 'es2015',
    outDir: 'dist'
  }
})