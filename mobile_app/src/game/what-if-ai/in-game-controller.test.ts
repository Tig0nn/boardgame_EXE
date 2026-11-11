import assert from 'node:assert/strict'
import test from 'node:test'
import type { EndgameAppBinding } from '../endgame-analysis-app-binding.ts'
import { newEnvelope, PROTOCOL } from '../endgame-analysis-protocol.ts'
import type { Response } from '../endgame-analysis-protocol.ts'
import { createInGameAiController } from './in-game-controller.ts'
import type { WhatIfProvider } from './orchestrator.ts'
import { createModelWhatIfProvider } from '../../../../src/ai/what-if/model-provider.ts'

function bindingFixture() {
  const envelope = newEnvelope(), hash = 'a'.repeat(64)
  const timing = { receivedAt: 0, finishedAt: 0, elapsedMs: 0 }
  const source: Response = { version: PROTOCOL, kind: 'SOURCE_VERIFIED', envelope, timing, body: {
    identity: { sourceHash: hash, configHash: hash, semanticHash: hash, engine: envelope.engine, profile: envelope.profile,
      schema: 7, entries: 1, commands: 1, characters: 1, utf8Bytes: 1, origin: 'snapshot',
      ending: { termination: 'completed', phase: 'finished', lap: 4, turn: 18, summaries: [1, 2, 3, 4], shortfall: 0 } },
    timings: { serializeMs: 0, parseMs: 0, actualReplayMs: 0, hashMs: 0 },
    capabilities: { worker: true, crypto: true, encoder: true, clone: true, dom: true },
  } }
  const list: Response = { version: PROTOCOL, kind: 'DECISIONS_READY', envelope, timing, body: { decisions: [] } }
  let capture = false, epoch = 1, terminalAt = 1, failure = false
  const binding = {
    inspect: () => ({ ...envelope, sessionEpoch: epoch, terminalAt, terminal: true, captureId: capture ? envelope.captureId : null, reason: failure ? 'transport-source-wire-cap' : null }),
    prepare: async () => { capture = !failure; return failure ? null : source },
    list: async () => list,
    read: () => capture ? list : null,
    cancel: () => { capture = false },
  } as unknown as EndgameAppBinding
  return { binding, replace: () => { epoch++; capture = false }, changeSnapshot: () => { terminalAt++; capture = false },
    fail: () => { failure = true }, recover: () => { failure = false } }
}

function deferredProvider() {
  const pending: { signal: AbortSignal; reply: (value: unknown) => void }[] = []
  const provider: WhatIfProvider = {
    interpret: (_input, signal) => new Promise(reply => pending.push({ signal, reply })),
    propose: async () => null,
    explain: async () => null,
  }
  return { provider, pending }
}

test('editing a pending question aborts the request and a late reply cannot replace the next response', async () => {
  const { binding } = bindingFixture(), { provider, pending } = deferredProvider()
  const controller = createInGameAiController(binding, () => provider)
  await controller.open()
  const old = controller.ask('Nếu tôi bỏ mua vàng thì sao?')
  controller.editQuestion()
  assert(pending[0].signal.aborted)
  const next = controller.ask('Mua CMG rồi bán CMG')
  pending[1].reply({ status: 'multiple-changes' })
  await next
  pending[0].reply({ status: 'unsupported' })
  await old
  assert.equal(controller.getSnapshot().stage, 'question')
  assert.match(controller.getSnapshot().notice ?? '', /nhiều thay đổi/)
})

test('replaced session and replaced terminal snapshot reject an outstanding provider response', async () => {
  for (const change of ['replace', 'changeSnapshot'] as const) {
    const fixture = bindingFixture()
    const pending: { signal: AbortSignal; reply: (text: string) => void }[] = []
    const provider = createModelWhatIfProvider((_input, signal) => new Promise(reply => pending.push({ signal, reply })))
    const controller = createInGameAiController(fixture.binding, () => provider)
    await controller.open()
    const old = controller.ask('Nếu tôi bỏ mua vàng thì sao?')
    fixture[change]()
    assert.equal(controller.getSnapshot().stage, 'closed')
    assert(pending[0].signal.aborted)
    await controller.open()
    pending[0].reply('{"status":"unsupported"}')
    await old
    assert.equal(controller.getSnapshot().stage, 'question')
    assert.equal(controller.getSnapshot().notice, undefined)
  }
})

test('capture failure stays visible and retry opens a fresh verified capture in the same panel', async () => {
  const fixture = bindingFixture(), { provider } = deferredProvider()
  const controller = createInGameAiController(fixture.binding, () => provider)
  fixture.fail()
  await controller.open()
  assert.equal(controller.getSnapshot().stage, 'blocked')
  assert.equal(controller.getSnapshot().rows, undefined)
  fixture.recover()
  await controller.restart()
  assert.equal(controller.getSnapshot().stage, 'question')
})
