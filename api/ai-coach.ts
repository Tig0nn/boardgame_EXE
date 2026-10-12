import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAICoachRequest } from '../src/ai/server/handler.ts'

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Phương thức không được hỗ trợ. Chỉ chấp nhận POST.' }))
    return
  }

  const forwarded = req.headers['x-forwarded-for']
  const clientIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || '127.0.0.1'

  let body = req.body
  if (!body) {
    body = await new Promise(resolve => {
      let data = ''
      req.on('data', chunk => {
        data += chunk
      })
      req.on('end', () => resolve(data))
    })
  }

  const result = await handleAICoachRequest(body, clientIp)
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result.body))
}
