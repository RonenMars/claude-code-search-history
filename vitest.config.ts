import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/index.d.ts',
        'src/renderer/src/env.d.ts',
        'src/renderer/index.html',
        'src/**/*.test.*',
        'src/test/**',
      ],
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
})
