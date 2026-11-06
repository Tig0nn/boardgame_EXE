import { createServer } from '../node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Isolated local review: no .env loading, API proxy or provider endpoint.
const server = await createServer({
  configFile: false, root: resolve('mobile_app'), envDir: resolve('.npm-cache/beta-no-env'),
  plugins: [react(), { name: 'beta-no-api', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Beta uses local explanations only') }
      else next()
    })
  } }],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, fs: { allow: [resolve('.')] } },
})
await server.listen()
server.printUrls()
console.log('Beta: http://127.0.0.1:5174/?aiBeta=1')
