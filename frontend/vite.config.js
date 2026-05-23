import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react-redux') || id.includes('@reduxjs/toolkit')) {
              return 'vendor';
            }
            if (id.includes('lucide-react') || id.includes('recharts') || id.includes('framer-motion')) {
              return 'ui';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
