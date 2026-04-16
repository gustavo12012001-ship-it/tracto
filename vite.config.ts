import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react-is'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Be specific: only react/react-dom/react-router, NOT react-is (needed by recharts)
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor'
          }
          // Keep react-is together with recharts so cross-chunk import works
          if (id.includes('node_modules/recharts') || id.includes('node_modules/react-is')) {
            return 'recharts'
          }
          if (id.includes('node_modules/leaflet')) return 'leaflet'
          if (id.includes('node_modules/framer-motion')) return 'framer-motion'
        }
      }
    }
  },
  server: {
    port: 5173,
  }
})

