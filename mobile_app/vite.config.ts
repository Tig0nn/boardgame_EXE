import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Shared root components must use the Mobile renderer's React instance.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5174,
    host: '127.0.0.1',
    proxy: {
      '/v1': {
        target: process.env.EXE_LOCAL_API_ORIGIN || 'http://127.0.0.1:3109',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
})
