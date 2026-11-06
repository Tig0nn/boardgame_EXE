import { preview } from '../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const root = fileURLToPath(new URL('../release/beta/', import.meta.url))
if (!existsSync(new URL('../release/beta/dist/index.html', import.meta.url))) throw Error('Build the approved local Preview artifact first.')
const server = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port: 5314, strictPort: true } })
server.printUrls()
console.log('Compiled Beta review: http://127.0.0.1:5314/?aiBeta=1 (local static artifact only)')
