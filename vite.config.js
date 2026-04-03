import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_BASE = process.env.VITE_API_BASE_URL || ''

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  define: {
    __API_BASE__: JSON.stringify(API_BASE)
  }
})
