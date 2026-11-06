import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export interface ReplayHashExpectation {
  file: string
  sha256: string
  crlfCheckoutSha256?: string
}

/** Verify frozen bytes, including an explicitly recorded Windows checkout representation. Never edits a log. */
export function verifyReplayInput(bytes: Buffer, expected: ReplayHashExpectation) {
  const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  const observedSha256 = digest(bytes)
  if (observedSha256 === expected.sha256) return { representation: 'committed' as const, observedSha256 }
  assert.ok(expected.file.endsWith('.json') && expected.crlfCheckoutSha256, 'Unexpected replay bytes: ' + expected.file)
  assert.equal(observedSha256, expected.crlfCheckoutSha256, 'Unrecognized checkout bytes: ' + expected.file)
  const committed = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
  assert.equal(digest(committed), expected.sha256, 'Checkout does not reproduce committed bytes: ' + expected.file)
  return { representation: 'verified-crlf-checkout' as const, observedSha256 }
}
