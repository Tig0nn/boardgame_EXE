import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { snapshotPayloadForInsert } from '../src/repositories/snapshot-payload.ts'

test('sends a small snapshot unchanged', () => {
  const payload = '{ "schemaVersion": 7 }'
  assert.equal(snapshotPayloadForInsert(payload), payload)
})

test('deduplicates repeated JSON while preserving every character and trailing newline', () => {
  const repeated = JSON.stringify({ message: 'Đầu tư \\ và "tiết kiệm" 🧾', balances: Array.from({ length: 300 }, (_, i) => i) }, null, 2)
  const payload = '{\r\n"schemaVersion":7,\r\n"entries":[\n' + Array(900).fill(repeated).join(',\n') + '\n]\r\n}\n'
  const value = snapshotPayloadForInsert(payload)
  assert.notEqual(typeof value, 'string')
  if (typeof value === 'string') throw new Error('Expected a deduplicated SQL parameter')
  const { params } = new PgDialect().sqlToQuery(value)
  const template = String(params[0])
  assert.ok(Array.isArray(params[1]), 'Send one native PostgreSQL array parameter')
  const chunks: string[] = params[1]
  assert.equal(params.length, 2)
  const positions = [...template.matchAll(/%(\d+)\$s/g)].map(match => Number(match[1]))
  assert.ok(Buffer.byteLength(template) + Buffer.byteLength(JSON.stringify(chunks)) < Buffer.byteLength(payload) / 4)
  assert.equal(positions.map(position => chunks[position - 1]).join(''), payload)
})

test('uses plain text when deduplication does not reduce the payload', () => {
  const payload = JSON.stringify({ text: 'a'.repeat(800_000) })
  assert.equal(snapshotPayloadForInsert(payload), payload)
})
