import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { integrationPreviewSettings } from './preview-policy.ts'
import { legacyAiIsolation } from '../release/beta/legacy-ai-isolation.ts'

// https://vite.dev/config/
export default defineConfig(() => {
  const preview = integrationPreviewSettings(process.env)
  return {
  plugins: [...(preview.enabled ? [legacyAiIsolation()] : []), react()],
  define: {
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(preview.environment),
    'import.meta.env.VITE_AI_COMPANION_BETA': JSON.stringify(preview.enabled ? '1' : '0'),
  },
  // Shared root components must use the Mobile renderer's React instance.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
  }
})
