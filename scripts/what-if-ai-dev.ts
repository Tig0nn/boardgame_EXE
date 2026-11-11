import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { WHAT_IF_ENDPOINT } from '../src/ai/what-if/contracts.ts'
import { createWhatIfHandler } from '../src/ai/what-if/server.ts'
import { mockServerProvider } from '../src/ai/what-if/mock-server-provider.ts'

export async function startWhatIfDev(port = 5196) {
  const handler = createWhatIfHandler(mockServerProvider)
  const server = await createServer({ root: resolve('mobile_app'), server: { host: '127.0.0.1', port, strictPort: true },
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startWhatIfDev()
  console.log('What-if mock HTTP ready at http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1 · LIVE_NOT_RUN')
}
