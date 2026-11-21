import assert from 'node:assert/strict'
import { createConnection, createServer } from 'node:net'
import { Transform } from 'node:stream'
import type { TransformCallback } from 'node:stream'

export const whatIfNetworkBytesPerSecond = 4 * 1024 * 1024

// Local sensitivity model only: PostgreSQL -> client is paced; requests,
// database execution, engine replay, and cancellation remain real.
export async function startWhatIfNetworkProxy(databaseUrl: URL, bytesPerSecond?: number) {
  assert.equal(databaseUrl.hostname, '127.0.0.1')
  assert.equal(databaseUrl.port, '55449', 'Only the isolated What-if PostgreSQL instance is allowed')
  assert.match(databaseUrl.pathname, /^\/exe_what_if_catalog_[a-f0-9]+$/)
  assert.ok(bytesPerSecond === undefined || bytesPerSecond === whatIfNetworkBytesPerSecond)
  let outboundBytes = 0
  const connections = new Set<() => void>()
  const server = createServer(client => {
    const upstream = createConnection({ host: '127.0.0.1', port: 55449 })
    client.setNoDelay(true)
    upstream.setNoDelay(true)
    let timer: ReturnType<typeof setTimeout> | undefined
    const response = new Transform({
      transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
        const deliver = () => {
          timer = undefined
          outboundBytes += chunk.length
          callback(null, chunk)
        }
        if (bytesPerSecond === undefined) deliver()
        else timer = setTimeout(deliver, Math.ceil(chunk.length * 1000 / bytesPerSecond))
      },
      destroy(error, callback) {
        if (timer !== undefined) clearTimeout(timer)
        callback(error)
      },
    })
    const close = () => {
      connections.delete(close)
      client.destroy()
      upstream.destroy()
      response.destroy()
    }
    connections.add(close)
    client.on('error', close)
    upstream.on('error', close)
    response.on('error', close)
    client.on('close', close)
    client.pipe(upstream)
    upstream.pipe(response).pipe(client)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const proxyUrl = new URL(databaseUrl)
  proxyUrl.port = String(address.port)
  return {
    url: proxyUrl,
    get bytes() { return outboundBytes },
    resetBytes() { outboundBytes = 0 },
    async close() {
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      for (const close of connections) close()
      await closed
    },
  }
}
