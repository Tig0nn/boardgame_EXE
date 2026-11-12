import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { MASCOT_EXPLANATION_ENDPOINT } from '../src/ai/mascot/contracts.ts'
import { createMascotExplanationHandler, MASCOT_DEFAULT_DEADLINE_MS, MASCOT_MAX_DEADLINE_MS, mockMascotProvider } from '../src/ai/mascot/server.ts'
import type { MascotProvider } from '../src/ai/mascot/server.ts'
import { createMascotGeminiProvider, DEFAULT_MASCOT_GEMINI_MODEL } from '../src/ai/mascot/gemini.ts'
import { LEARNING_ENDPOINT } from '../src/ai/mascot/learning.ts'
import { createGeminiLearningProvider, createLearningHandler } from '../src/ai/mascot/learning-server.ts'
import type { LearningProvider } from '../src/ai/mascot/learning-server.ts'
import { WHAT_IF_ENDPOINT } from '../src/ai/what-if/contracts.ts'
import { createWhatIfHandler, resolveWhatIfServerDeadlineMs } from '../src/ai/what-if/server.ts'
import { mockServerProvider } from '../src/ai/what-if/mock-server-provider.ts'

type LocalOptions = Pick<NonNullable<Parameters<typeof createMascotExplanationHandler>[0]>, 'deadlineMs' | 'maxCalls' | 'allowContext' | 'onDiagnostic'> & { learningProvider?: LearningProvider | null; learningDeadlineMs?: number }

export async function startMascotDev(port: number, provider: MascotProvider | null = mockMascotProvider, cacheDir?: string,
  { deadlineMs = MASCOT_DEFAULT_DEADLINE_MS, learningProvider = null, learningDeadlineMs, ...options }: LocalOptions = {}) {
  const mascot = createMascotExplanationHandler({ origin: `http://127.0.0.1:${port}`, provider: provider ?? undefined, deadlineMs, ...options })
  const learning = createLearningHandler(learningProvider
    ? { origin: `http://127.0.0.1:${port}`, provider: learningProvider, deadlineMs: learningDeadlineMs }
    : undefined)
  const whatIf = createWhatIfHandler(mockServerProvider)
  const server = await createServer({
    root: resolve('mobile_app'),
    cacheDir,
    define: {
      'import.meta.env.VITE_MASCOT_LEARNING_ENABLED': JSON.stringify(learningProvider ? '1' : '0'),
      'import.meta.env.MASCOT_CLIENT_DEADLINE_MS': JSON.stringify(deadlineMs + 1000),
      'import.meta.env.WHAT_IF_PROVIDER_MODE': JSON.stringify('mock'),
      'import.meta.env.WHAT_IF_SERVER_DEADLINE_MS': JSON.stringify(resolveWhatIfServerDeadlineMs()),
    },
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'mascot-local-provider',
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          const path = req.url?.split('?')[0]
          if (path === MASCOT_EXPLANATION_ENDPOINT) void mascot(req, res)
          else if (path === LEARNING_ENDPOINT) void learning(req, res)
          else if (path === WHAT_IF_ENDPOINT) void whatIf(req, res)
          else if (path?.startsWith('/api/')) {
            // Keep the demo's API traffic inside the handlers mounted above.
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
            res.end(JSON.stringify({ error: 'NOT_FOUND' }))
          } else next()
        })
      },
    }],
  })
  await server.listen()
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 5198)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid demo port')
  const args = process.argv.slice(3)
  if (args.length > 1 || (args[0] && !['--live', '--verify-live', '--offline', '--learning-live'].includes(args[0]))) {
    throw new Error('Choose --live, --verify-live, --learning-live or --offline')
  }
  const verify = args[0] === '--verify-live'
  const live = verify || args[0] === '--live'
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MASCOT_GEMINI_MODEL
  const provider = live ? createMascotGeminiProvider({
    approved: true, credential: process.env.GEMINI_API_KEY, model, transport: globalThis.fetch,
  }) ?? null : args[0] === '--offline' ? null : mockMascotProvider
  if (verify && !provider) throw new Error('Live verification requires a configured Gemini key and model')
  const deadlineMs = live ? Number(process.env.MASCOT_SERVER_DEADLINE_MS ?? MASCOT_MAX_DEADLINE_MS) : MASCOT_DEFAULT_DEADLINE_MS
  const options: LocalOptions = { deadlineMs }
  if (args[0] === '--learning-live') {
    const learningProvider = createGeminiLearningProvider({ credential: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL, transport: globalThis.fetch })
    if (!learningProvider) throw new Error('Learning live requires a configured Gemini key and model')
    options.learningProvider = learningProvider
    options.learningDeadlineMs = process.env.MASCOT_LEARNING_DEADLINE_MS === undefined
      ? undefined : Number(process.env.MASCOT_LEARNING_DEADLINE_MS)
  }
  if (live && provider) options.onDiagnostic = event => console.log(JSON.stringify({ at: new Date().toISOString(), model, ...event }))
  if (verify) {
    // Matches the synthetic routine demo after buying exactly 20,000,000 VND of gold.
    options.maxCalls = 2
    options.allowContext = ({ topic, facts }) => topic === 'cash-exhaustion' && facts.asset === 'gold'
      && facts.cashBefore === 20_000_000 && facts.amount === 20_000_000 && facts.cash === 0 && facts.knownPayments === 0
  }
  await startMascotDev(port, provider, undefined, options)
  console.log(JSON.stringify({ provider: provider?.source ?? 'offline', learning: options.learningProvider?.source ?? 'offline', deadlineMs, ...(live && provider ? { model } : {}) }))
  console.log(`Cáo EXE · http://127.0.0.1:${port}/?mascotDemo=${verify ? 'routine' : 'bank'}`)
}
