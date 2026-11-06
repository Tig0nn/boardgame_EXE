import { build } from '../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { betaBuildSettings } from '../release/beta/build-policy.ts'

const settings = betaBuildSettings(process.env)
process.env.NODE_ENV = 'production'
// Build only. No Vercel CLI, project linking, API routes, credentials or deployment.
await build({ configFile: fileURLToPath(new URL('../release/beta/vite.config.ts', import.meta.url)), mode: 'production' })
writeFileSync(new URL('../release/beta/dist/beta-build-info.json', import.meta.url), JSON.stringify({ ...settings, viteMode: 'production', nodeEnvironment: 'production', providers: false, serverFunctions: false }) + '\n')
