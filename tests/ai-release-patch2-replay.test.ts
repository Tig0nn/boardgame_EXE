import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const frozenCommittedHashes = {
  'docs/playtests/a-log.json': '9c211e051c0ba3cdd4a27e6febb4f49d7b67a27cb4a50854e518da04212bf0c5',
  'docs/playtests/b-log.json': '422d69f21e0e28a0d8574ef263591cc987c1421ba476b0779e1926e79e9df477',
  'docs/playtests/original-log.json': 'fe80ab162036a77b6aeb11cb193753aca92dc485d75f464d5b59beac6d2dff02',
  'docs/playtests/v2_2-b-log.json': 'def4500c782dd0f7cf175f396e7d7d2f3e4fa9ecaf044d740cffae56bda586fe',
}

test('Replay inventory names exact committed blob hashes, independently of Windows checkout EOL', () => {
  const inventory = JSON.parse(readFileSync('tests/fixtures/ai-companion/release-historical-replays.json', 'utf8')) as { results: { file: string; sha256: string }[] }
  assert.equal(inventory.results.length, 139)
  for (const [file, sha256] of Object.entries(frozenCommittedHashes)) assert.equal(inventory.results.find(r => r.file === file)?.sha256, sha256, file)
})

test('Replay integrity accepts exact bytes and only an explicitly hashed CRLF checkout; tampering fails', async () => {
  const { verifyReplayInput } = await import('../scripts/diagnostics/replay-input-integrity.ts')
  const committed = Buffer.from('{"schemaVersion":4}\n'), checkout = Buffer.from('{"schemaVersion":4}\r\n')
  const entry = { file: 'synthetic-replay.json', sha256: digest(committed), crlfCheckoutSha256: digest(checkout) }
  const before = Buffer.from(checkout)
  assert.equal(verifyReplayInput(committed, entry).representation, 'committed')
  assert.equal(verifyReplayInput(checkout, entry).representation, 'verified-crlf-checkout')
  assert.deepEqual(checkout, before)
  assert.throws(() => verifyReplayInput(checkout, { file: entry.file, sha256: entry.sha256 }))
  assert.throws(() => verifyReplayInput(Buffer.from('{"schemaVersion":5}\r\n'), entry))
  assert.throws(() => verifyReplayInput(Buffer.from('{"schemaVersion":4} \r\n'), entry))
  assert.throws(() => verifyReplayInput(checkout, { ...entry, sha256: digest(Buffer.from('other\n')) }))
  assert.throws(() => verifyReplayInput(checkout, { ...entry, file: 'synthetic-replay.json.gz' }))
})
