import assert from 'node:assert/strict'
import test from 'node:test'
import { explainWhatIf, runWhatIfPrompt } from './orchestrator.ts'
import type { WhatIfDecision } from './orchestrator.ts'
import { mockGemini } from './mock-gemini.ts'
import { askGold } from './gold.ts'
import type { EndgameView } from '../endgame-whatif-ui-controller.ts'

const gold: WhatIfDecision = { kind: 'gold', decisionId: 'gold:4', alternativeId: 'skip', lap: 1, turn: 1 }
const signal = () => new AbortController().signal

test('mock selects the unique catalog entry and passes only the trusted choice to replay', async () => {
  const selected: WhatIfDecision[] = []
  assert.equal(await runWhatIfPrompt(mockGemini, 'Nếu tôi bỏ mua vàng thì sao?', [gold], signal(), async decision => {
    selected.push(decision)
  }), 'submitted')
  assert.deepEqual(selected, [gold])
})

test('unsupported, bundled follow-up, and ambiguous requests do not reach the engine', async () => {
  const replay = async () => { assert.fail('unexpected replay') }
  for (const prompt of ['Mua cổ phiếu', 'Bỏ mua vàng và bỏ bán vàng', 'Không bỏ mua vàng', 'Bỏ mua vàng và vay tiền']) {
    assert.equal(await runWhatIfPrompt(mockGemini, prompt, [gold], signal(), replay), 'unsupported')
  }
  assert.equal(await runWhatIfPrompt(mockGemini, 'Bỏ mua vàng', [gold, { ...gold, decisionId: 'gold:8' }], signal(), replay), 'unsupported')
})

test('provider cannot add financial fields, invent IDs, or pick a different alternative', async () => {
  for (const response of [null, { decisionId: 'gold:42', alternativeId: 'skip' },
    { decisionId: 'gold:4', alternativeId: 'buy' }, { decisionId: 'gold:4', alternativeId: 'skip', amount: 42 },
    Object.defineProperty({ alternativeId: 'skip' }, 'decisionId', { get: () => assert.fail('accessor executed') })]) {
    const provider = { ...mockGemini, propose: async () => response }
    assert.equal(await runWhatIfPrompt(provider, 'Bỏ mua vàng', [gold], signal(), async () => assert.fail()), 'unsupported')
  }
})

test('a provider response arriving after cancellation cannot run an action', async () => {
  const abort = new AbortController()
  let resolve!: (value: unknown) => void
  const provider = { ...mockGemini, propose: () => new Promise(done => { resolve = done }) }
  const pending = runWhatIfPrompt(provider, 'Bỏ mua vàng', [gold], abort.signal, async () => assert.fail())
  abort.abort()
  resolve({ decisionId: 'gold:4', alternativeId: 'skip' })
  await assert.rejects(pending, { name: 'AbortError' })
})

test('replacing a Gold catalog rejects a delayed provider even when its decision IDs recur', async () => {
  let view: EndgameView = { kind: 'catalog', decisions: [{ sequence: 4, lap: 1, turn: 1, amount: '5 ₫' }] }
  const controller = { getSnapshot: () => view, create: async () => assert.fail('stale selection reached engine') }
  let resolve!: (value: unknown) => void
  const provider = { ...mockGemini, propose: () => new Promise(done => { resolve = done }) }
  const pending = askGold(controller, provider, 'Bỏ mua vàng', signal())
  view = structuredClone(view)
  resolve({ decisionId: 'gold:4', alternativeId: 'skip' })
  await assert.rejects(pending, { name: 'AbortError' })
})

test('explanations accept only the engine-supported claim ID, with no provider prose or numbers', async () => {
  const facts = { kind: 'gold', direction: 'up', confirmedFollowUp: true } as const
  assert.match(await explainWhatIf(mockGemini, facts, signal()) ?? '', /bỏ qua lần bán/)
  for (const output of ['Bạn có thêm 42 đồng', { claimId: 'bank-up' }, { claimId: 'gold-up', amount: 42 }]) {
    assert.equal(await explainWhatIf({ ...mockGemini, explain: async () => output }, facts, signal()), null)
  }
})
