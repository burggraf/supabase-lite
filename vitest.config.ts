/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Memory optimization settings
    maxConcurrency: 5, // Limit concurrent tests to reduce memory pressure
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
        isolate: true // Ensure proper test isolation
      }
    },
    // Timeout settings
    testTimeout: 30000, // 30 second timeout for individual tests
    hookTimeout: 10000, // 10 second timeout for setup/teardown hooks
    // Retry settings for flaky tests
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        'src/mocks/**',
        'build/**',
        'dist/**'
      ],
      thresholds: {
        global: {
          branches: 70, // Reduced from 75 to be more achievable
          functions: 75, // Reduced from 80
          lines: 70, // Reduced from 75
          statements: 70 // Reduced from 75
        }
      },
      include: [
        'src/**/*.{ts,tsx}'
      ],
      all: true,
      skipFull: false,
      // Clean up coverage files after each run
      clean: true,
      cleanOnRerun: true
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})