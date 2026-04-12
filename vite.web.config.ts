// Web build target — produces a standalone static bundle in dist-web/
// that can be served by `cch serve` (Go HTTP server).
// No Electron deps. window.__TRANSPORT__ is set to 'ws' at build time.

import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html'),
    },
  },
  define: {
    // Signal to transport.ts and any conditional Electron code
    'window.__TRANSPORT__': JSON.stringify('ws'),
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react()],
})
