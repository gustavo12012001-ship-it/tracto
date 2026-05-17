import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // skipWaiting + clientsClaim garantem que novo SW assume controle imediatamente
      // sem precisar fechar todas as abas. Pareado com NetworkFirst em /api/ e em
      // index.html, garante que código novo é entregue na primeira navegação.
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Tracto — Plataforma AgTech',
        short_name: 'Tracto',
        description: 'Monitoramento agronômico inteligente por satélite e IA',
        theme_color: '#080809',
        background_color: '#080809',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/dashboard',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // index.html via NetworkFirst pra sempre buscar versão nova primeiro
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Open-Meteo — cache 30 min
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'open-meteo', expiration: { maxAgeSeconds: 1800, maxEntries: 20 } },
          },
          // Open-Meteo Archive — cache 24h (dados históricos)
          {
            urlPattern: /^https:\/\/archive-api\.open-meteo\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'open-meteo-archive', expiration: { maxAgeSeconds: 86400, maxEntries: 50 } },
          },
          // Backend Tracto — Network first, fallback cache 5 min
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'tracto-api', networkTimeoutSeconds: 5, expiration: { maxAgeSeconds: 300, maxEntries: 100 } },
          },
          // Tiles de mapas — cache agressivo (1 semana)
          {
            urlPattern: /^https:\/\/(mt[0-3]\.google\.com|server\.arcgisonline\.com|[abc]\.tile\.openstreetmap\.org)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxAgeSeconds: 604800, maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
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

