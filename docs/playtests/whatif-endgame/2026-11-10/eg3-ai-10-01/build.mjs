import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { build } = await import(pathToFileURL(resolve('mobile_app/node_modules/vite/dist/node/index.js')).href)
const result = await build({ root: resolve('mobile_app'), logLevel: 'warn', build: { write: false, copyPublicDir: false } })
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output)
assert(outputs.length > 0)
assert(!outputs.some(item => item.type === 'chunk' && item.code.includes('/api/what-if-provider')))
writeFileSync(resolve(import.meta.dirname, (process.argv[2] ?? 'build') + '.json'), JSON.stringify({ mode: 'production', write: false, whatIfDevTransportIncluded: false,
  outputs: outputs.map(item => ({ file: item.fileName, bytes: item.type === 'chunk' ? Buffer.byteLength(item.code) : Buffer.byteLength(item.source) })) }, null, 2), { flag: 'wx' })
console.log('PRODUCTION BUILD PASS · in-memory · DEV HTTP provider excluded')
