import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { WHAT_IF_ENDPOINT } from '../src/ai/what-if/contracts.ts'
import { createWhatIfHandler } from '../src/ai/what-if/server.ts'
import { mockServerProvider } from '../src/ai/what-if/mock-server-provider.ts'
import { createWhatIfGeminiProvider, hasWhatIfGeminiConfig } from '../src/ai/what-if/gemini.ts'
import type { GeminiOptions } from '../src/ai/what-if/gemini.ts'

type WhatIfDevMode = { mode: 'mock' } | { mode: 'gemini'; gemini: GeminiOptions }

export async function startWhatIfDev(port = 5196, options: WhatIfDevMode = { mode: 'mock' },
  limits?: Parameters<typeof createWhatIfHandler>[1]) {
  if (options.mode === 'gemini' && !hasWhatIfGeminiConfig(options.gemini)) {
    throw new Error('Gemini DEV requires approved access, live traffic opt-in, a model and server credentials.')
  }
  const provider = options.mode === 'gemini' ? createWhatIfGeminiProvider(options.gemini) : mockServerProvider
  const handler = createWhatIfHandler(provider, limits)
  const server = await createServer({ root: resolve('mobile_app'), server: { host: '127.0.0.1', port, strictPort: true },
    define: { 'import.meta.env.WHAT_IF_PROVIDER_MODE': JSON.stringify(options.mode) },
    plugins: [{ name: 'what-if-provider-only', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === WHAT_IF_ENDPOINT) void handler(req, res)
        else next()
      })
    } }],
  })
  await server.listen()
  return server
}
function environmentMode(): WhatIfDevMode {
  const mode = process.env.WHAT_IF_AI_MODE ?? 'mock'
  if (mode === 'mock') return { mode }
  if (mode !== 'gemini') throw new Error('WHAT_IF_AI_MODE must be mock or gemini.')
  return { mode, gemini: {
    accessApproved: process.env.WHAT_IF_GEMINI_ACCESS_APPROVED === '1',
    allowLiveTraffic: process.env.WHAT_IF_GEMINI_ALLOW_LIVE_TRAFFIC === '1',
    model: process.env.WHAT_IF_GEMINI_MODEL,
    apiKey: process.env.WHAT_IF_GEMINI_API_KEY,
    fetch: globalThis.fetch,
  } }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = environmentMode()
  await startWhatIfDev(5196, options)
  console.log('What-if ' + options.mode + ' HTTP ready at http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1')
}
