import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameApi } from '../../src/game/server-session.ts'
import type { WhatIfRequest } from '../../src/game/cloud-contract.ts'

const input: WhatIfRequest = { stateVersion: 60, sequence: 53, alternative: {
  mode: 'replace', action: { actionId: 'choose', payload: { optionId: 'course-advanced' } },
} }
const claim = { id: 'course-down', text: 'Tiền mặt cuối vòng 4 thấp hơn theo replay.', basis: 'verified-final-cash' }
const evaluation = { status: 'completed', stateVersion: 60, sequence: 53,
  delta: { cash: -1, lawfulProceedsVnd: '2' },
  coach: { cards: [{ id: 'cash-at-decision', text: 'Thông tin tại thời điểm quyết định.' }] },
}
const reply = { version: 1, operation: 'explain', status: 'completed', assistance: 'not-requested',
  stateVersion: 60, evaluation, claim }

function fixture(response: object, gemini = false) {
  let calls = 0
  const api = createGameApi(async () => 'fixture', async (url, options) => {
    calls++
    assert.equal(url, '/v1/game-sessions/fixture/what-if/assistant')
    assert.deepEqual(JSON.parse(String(options?.body)), { ...input, operation: 'explain', allowGemini: gemini })
    return Response.json(response)
  }, gemini)
  return { run: () => api.simulateWhatIf('fixture', input), calls: () => calls }
}

for (const assistance of ['not-requested', 'used', 'disabled', 'unavailable', 'timeout', 'rate-limited', 'output-rejected']) {
  test('preserves verified final-cash text and the evaluation for ' + assistance, async () => {
    const transport = fixture({ ...reply, assistance }, assistance !== 'not-requested')
    const result = await transport.run()
    assert.equal(result.explanation, claim.text)
    assert.deepEqual(result.evaluation, evaluation)
    assert.equal(transport.calls(), 1)
  })
}

for (const [name, changes] of Object.entries({
  limited: { status: 'limited', evaluation: { ...evaluation, status: 'limited' } },
  'limited evaluation': { evaluation: { ...evaluation, status: 'limited' } },
  'limited envelope': { status: 'limited' },
  'not applicable': { assistance: 'not-applicable' }, unknown: { assistance: 'other' },
  'null claim': { claim: null }, 'missing claim': { claim: undefined },
  'incorrect basis': { claim: { ...claim, basis: 'final-proceeds' } },
  'blank ID': { claim: { ...claim, id: '  ' } }, 'missing ID': { claim: { ...claim, id: undefined } },
  'blank text': { claim: { ...claim, text: '  ' } }, 'non-string text': { claim: { ...claim, text: 42 } },
})) {
  test('leaves coach fallback available for ' + name, async () => {
    const transport = fixture({ ...reply, assistance: 'used', ...changes }, true)
    assert.equal((await transport.run()).explanation, undefined)
    assert.equal(transport.calls(), 1)
  })
}

for (const [name, changes] of Object.entries({
  version: { version: 2 }, operation: { operation: 'propose' }, stateVersion: { stateVersion: 59 },
  'evaluation version': { evaluation: { ...evaluation, stateVersion: 59 } },
  sequence: { evaluation: { ...evaluation, sequence: 52 } },
})) {
  test('rejects mismatched ' + name + ' without a simulation fallback', async () => {
    const transport = fixture({ ...reply, ...changes })
    await assert.rejects(transport.run(), /không khớp/)
    assert.equal(transport.calls(), 1)
  })
}
