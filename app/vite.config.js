import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api dan /uploads ke server Express (port 4000) saat development.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@codesandbox/sandpack') || id.includes('@codemirror') || id.includes('@lezer') || id.includes('codemirror')) return 'sandpack'
          if (id.includes('framer-motion') || id.includes('motion-')) return 'motion'
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
          if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) return 'react-vendor'
        },
      },
    },
  },
  server: {
    // Port dikunci: Google OAuth hanya mengizinkan origin http://localhost:5173.
    // Tanpa strictPort, Vite diam-diam pindah ke 5174 jika 5173 dipakai → login Google gagal.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
