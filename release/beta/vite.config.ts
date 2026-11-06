import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { betaBuildSettings } from './build-policy.ts'
import { legacyAiIsolation } from './legacy-ai-isolation.ts'

export default defineConfig(() => {
  const settings = betaBuildSettings(process.env)
  return {
    root: fileURLToPath(new URL('../../mobile_app/', import.meta.url)),
    envDir: false as const,
    envPrefix: [],
    plugins: [legacyAiIsolation(), react()],
    resolve: { dedupe: ['react', 'react-dom'] },
    define: {
      'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(settings.environment),
      'import.meta.env.VITE_AI_COMPANION_BETA': JSON.stringify(settings.enabled),
    },
    build: { outDir: fileURLToPath(new URL('./dist/', import.meta.url)), emptyOutDir: true, sourcemap: false },
  }
})
