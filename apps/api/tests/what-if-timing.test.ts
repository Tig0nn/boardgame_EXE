import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../src/errors.ts'
import { WhatIfTrace } from '../src/services/what-if-timing.ts'
import type { WhatIfTiming } from '../src/services/what-if-timing.ts'
import { WhatIfBudget } from '../src/services/what-if-replay.ts'

test('What-if timings retain error classification without confidential data', async () => {
  const events: WhatIfTiming[] = []
  const trace = new WhatIfTrace(event => events.push(event))
  trace.stateVersion = 60
  assert.equal(trace.sync('final_hash', () => 'not-logged', { payloadBytes: 16_586_551 }), 'not-logged')
  const failure = new ApiError(503, 'WHAT_IF_BUDGET_EXCEEDED', 'sensitive raw payload')
  await assert.rejects(trace.run('action_replay', async () => { throw failure }), error => error === failure)
  assert.equal(events[1].errorCode, 'WHAT_IF_BUDGET_EXCEEDED')
  assert.equal(events[0].stateVersion, 60)
  assert.equal(events[0].payloadBytes, 16_586_551)
  assert.ok(events.every(event => Number.isFinite(event.durationMs) && event.durationMs >= 0))
  assert.doesNotMatch(JSON.stringify(events), /sensitive|not-logged|message|userId|sessionId|payload":/)
})

test('observer failure cannot change the operation result or original error', () => {
  const trace = new WhatIfTrace(() => { throw Error('observer failed') })
  assert.equal(trace.sync('decision_catalog', () => 22), 22)
  const original = Error('original')
  assert.throws(() => trace.sync('final_hash', () => { throw original }), error => error === original)
})

test('deadline and cancellation report a bounded cause and the last measured stage', () => {
  for (const aborted of [false, true]) {
    const events: WhatIfTiming[] = []
    const trace = new WhatIfTrace(event => events.push(event))
    const controller = new AbortController()
    if (aborted) controller.abort('sensitive cancellation reason')
    const budget = new WhatIfBudget(controller.signal, 0, trace)
    budget.time('final_hash', () => 1)
    assert.throws(() => budget.check(), { code: 'WHAT_IF_BUDGET_EXCEEDED' })
    assert.equal(events.at(-1)?.reason, aborted ? 'aborted' : 'deadline')
    assert.equal(events.at(-1)?.lastStage, 'final_hash')
    assert.doesNotMatch(JSON.stringify(events), /sensitive/)
  }
})

test('query failures preserve SQLSTATE without forwarding SQL or error messages', async () => {
  const events: WhatIfTiming[] = []
  const trace = new WhatIfTrace(event => events.push(event))
  const failure = Object.assign(Error('sensitive SQL credentials'), { code: '57014', severity: 'ERROR' })
  await assert.rejects(trace.run('session_query', async () => { throw failure }))
  assert.equal(events[0].sqlState, '57014')
  assert.doesNotMatch(JSON.stringify(events), /sensitive|credentials/)
})
