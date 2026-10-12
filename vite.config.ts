import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleAICoachRequest } from './src/ai/server/handler.ts'

function aiCoachDevPlugin(apiKey?: string): Plugin {
  return {
    name: 'ai-coach-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/ai-coach', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Chỉ chấp nhận phương thức POST' }))
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', async () => {
          const forwarded = req.headers['x-forwarded-for']
          const clientIp = Array.isArray(forwarded)
            ? forwarded[0]
            : typeof forwarded === 'string'
              ? forwarded.split(',')[0].trim()
              : req.socket.remoteAddress || '127.0.0.1'

          const result = await handleAICoachRequest(body, clientIp, apiKey)
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }

  return {
    plugins: [react(), aiCoachDevPlugin(env.GEMINI_API_KEY)],
  }
})
