/// <reference types="node" />
import { Buffer } from 'node:buffer'
import type { IncomingMessage } from 'node:http'
import { MAX_REQUEST_BYTES } from '../contracts.ts'
import { CompanionContractError } from '../errors.ts'

/** Raw ingress only: a runtime that already parsed an object must fail closed. */
export async function readRequestBody(req: IncomingMessage, signal: AbortSignal): Promise<string> {
  const type = req.headers['content-type']
  if (typeof type !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)
    || req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new CompanionContractError('INVALID_REQUEST')
  }
  const length = req.headers['content-length']
  if (length !== undefined) {
    if (typeof length !== 'string' || !/^\d{1,10}$/.test(length)) throw new CompanionContractError('INVALID_REQUEST')
    if (Number(length) > MAX_REQUEST_BYTES) throw new CompanionContractError('PAYLOAD_TOO_LARGE')
  }
  const decode = (bytes: Uint8Array) => {
    if (bytes.byteLength > MAX_REQUEST_BYTES) throw new CompanionContractError('PAYLOAD_TOO_LARGE')
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { throw new CompanionContractError('INVALID_JSON') }
  }
  const suppliedBody: unknown = (req as IncomingMessage & { body?: unknown }).body
  if (suppliedBody !== undefined) {
    if (typeof suppliedBody === 'string') {
      if (Buffer.byteLength(suppliedBody, 'utf8') > MAX_REQUEST_BYTES) throw new CompanionContractError('PAYLOAD_TOO_LARGE')
      return decode(Buffer.from(suppliedBody, 'utf8'))
    }
    if (Buffer.isBuffer(suppliedBody)) return decode(suppliedBody)
    throw new CompanionContractError('INVALID_REQUEST')
  }
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    const cleanup = () => {
      req.off('data', data).off('end', end).off('error', error)
      signal.removeEventListener('abort', aborted)
    }
    const error = () => { cleanup(); reject(new CompanionContractError('INVALID_REQUEST')) }
    const aborted = () => { req.pause(); cleanup(); reject(signal.reason) }
    const data = (chunk: Buffer | string) => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      size += bytes.byteLength
      if (size > MAX_REQUEST_BYTES) {
        req.pause(); cleanup(); reject(new CompanionContractError('PAYLOAD_TOO_LARGE'))
      } else chunks.push(bytes)
    }
    const end = () => {
      cleanup()
      try { resolve(decode(Buffer.concat(chunks, size))) } catch (cause) { reject(cause) }
    }
    if (signal.aborted) { aborted(); return }
    req.on('data', data).once('end', end).once('error', error)
    signal.addEventListener('abort', aborted, { once: true })
  })
}
