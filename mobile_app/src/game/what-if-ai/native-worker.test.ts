import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Worker as NodeWorker } from 'node:worker_threads'
import { gunzipSync } from 'node:zlib'
import { createAnalysisBinding } from '../endgame-analysis-binding.ts'
import { newEnvelope } from '../endgame-analysis-protocol.ts'
import type { FinalCore } from '../endgame-analysis-protocol.ts'
import { createAnalysisClient } from '../endgame-analysis-worker-client.ts'
import { createEndgameUiController } from '../endgame-whatif-ui-controller.ts'
import { askBank, explainBank, requestBank } from './bank.ts'
import { askGold, explainGold } from './gold.ts'
import { mockGemini } from './mock-gemini.ts'
import { askDecision, createDecisionClient } from './decision-client.ts'
import { multiAssetFixture } from '../../../../scripts/diagnostics/what-if-multi-asset-fixtures.ts'

function fixture(name: string) {
  return gunzipSync(readFileSync(`docs/playtests/core-mvp-b18-multi-course/${name}.json.gz`)).toString('utf8')
}

// Run the real browser Worker entry in an actual thread using its Web Worker message surface.
function workerPort(entry: URL, onTerminate: () => void) {
  const code = `import { parentPort } from 'node:worker_threads';
    globalThis.self = { postMessage: value => parentPort.postMessage(value) };
    await import(${JSON.stringify(entry.href)});
    parentPort.on('message', data => self.onmessage?.({ data }));`
  const worker = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(code)}`))
  const port: Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'> = {
    postMessage: (value: unknown) => worker.postMessage(value),
    terminate() { onTerminate(); void worker.terminate() },
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  }
  worker.on('message', data => port.onmessage?.call(port as unknown as Worker, { data } as MessageEvent))
  worker.on('error', error => port.onerror?.call(port as unknown as Worker, { error } as ErrorEvent))
  worker.on('messageerror', data => port.onmessageerror?.call(port as unknown as Worker, { data } as MessageEvent))
  return port
}

test('Gold C1 through mock AI and native Worker pauses for confirmation then verifies all three deltas', { timeout: 60_000 }, async () => {
  const text = fixture('browser-390-trades')
  let terminated = 0
  const transport = createAnalysisBinding(e => createAnalysisClient(e, {
    factory: () => workerPort(new URL('../endgame-analysis.worker.ts', import.meta.url), () => terminated++),
  }))
  const envelope = newEnvelope()
  let capture = false
  const controller = createEndgameUiController({
    inspect: () => ({ ...envelope, captureId: capture ? envelope.captureId : null, terminal: true, reason: null }),
    prepare: () => { capture = true; transport.activate(envelope); return transport.request('PREPARE_SOURCE', { source: { kind: 'text', text } }) },
    list: () => transport.request('LIST_ELIGIBLE_DECISIONS', {}),
    create: selection => transport.request('CREATE_ANALYSIS', { selection, alternative: 'skip' }),
    followUp: input => transport.request('FOLLOWUP_SELECTION', input),
    read: transport.read,
    cancel: () => { capture = false; transport.cancel() },
  })
  const unmount = controller.mount(() => () => {})
  const signal = new AbortController().signal
  try {
    await controller.open()
    const catalog = controller.getSnapshot()
    assert.equal(catalog.kind, 'catalog')
    assert.deepEqual(catalog.decisions.map(decision => decision.sequence), [4])
    assert.equal(await askGold(controller, mockGemini, 'Nếu tôi bỏ mua vàng thì sao?', signal), 'submitted')
    const pending = controller.getSnapshot()
    assert.equal(pending.kind, 'followup')
    assert.equal(pending.sequence, 25)
    assert.equal(transport.read()?.kind, 'NEEDS_FOLLOWUP')
    assert.equal('delta' in transport.read()!.body, false)
    assert.equal(await askGold(controller, mockGemini, 'Bỏ mua vàng', signal), 'unsupported')

    await controller.followUp()
    controller.readFinal()
    const view = controller.getSnapshot()
    assert.equal(view.kind, 'final')
    const { delta, proof } = transport.read()!.body as FinalCore
    assert.deepEqual([delta.cash, delta.totalWorth, delta.liquidatableFunds], [104_006, 104_006, 104_006])
    assert.equal(proof.actualReplay && proof.alternativeReplay && proof.sourceUnchanged, true)
    assert.match(await explainGold(mockGemini, view, signal) ?? '', /bỏ qua lần bán đã xác nhận/)
    controller.close()
    assert.equal(transport.read(), null)
  } finally {
    unmount()
    transport.dispose()
  }
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(terminated, 1)
})

test('independent Bank fixture through the same mock orchestration and native replay reaches verified START4', { timeout: 60_000 }, async () => {
  const text = fixture('frozen-screen-cash-roi')
  const signal = new AbortController().signal
  let terminated = 0
  const request: typeof requestBank = (input, requestSignal) => requestBank(input, requestSignal,
    () => workerPort(new URL('./bank.worker.ts', import.meta.url), () => terminated++))
  const result = await askBank(text, mockGemini, 'Nếu tôi gửi tiết kiệm ở ngân hàng thì sao?', signal, request)
  assert.equal(result.kind, 'final', result.kind === 'blocked' ? result.reason : 'Bank comparison expected')
  const { comparison } = result
  assert.equal(comparison.lap, 4)
  assert.equal(comparison.proof.actualReplay && comparison.proof.alternativeReplay, true)
  const { cash, totalWorth, liquidatableFunds } = comparison.delta
  assert.deepEqual([cash, totalWorth, liquidatableFunds], [200_000, 200_000, 200_000])
  assert.match(await explainBank(mockGemini, comparison, signal) ?? '', /gửi tiết kiệm một kỳ START/)
  const forged = await request({ text, selection: { kind: 'bank', decisionId: 'bank:36', alternativeId: 'skip', lap: 2, turn: 9 } }, signal)
  assert.deepEqual(forged, { kind: 'blocked', reason: 'bank-selection-invalid' })
  assert.equal(terminated, 3)
})

test('Bank cancellation removes the Worker listeners and suppresses late responses', async () => {
  const abort = new AbortController()
  let terminated = 0
  const port = { onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate: () => terminated++ }
  const pending = requestBank({ text: 'never used' }, abort.signal, () => port)
  abort.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(terminated, 1)
  assert.equal(port.onmessage, null)
})

test('new Course selection passes mock AI validation and native Worker replay with a verified terminal delta', { timeout: 60_000 }, async () => {
  const abort = new AbortController()
  let terminated = 0
  const client = createDecisionClient(abort.signal,
    () => workerPort(new URL('./decision.worker.ts', import.meta.url), () => terminated++))
  try {
    const result = await askDecision(client, fixture('frozen-holdout-diversified-roi'), 'course', mockGemini,
      'Nếu tôi học khóa cơ bản tại quyết định 49 thì sao?', abort.signal)
    assert.equal(result?.status, 'supported-final')
    const { comparison } = result
    assert.deepEqual([comparison.delta.cash, comparison.delta.totalWorth, comparison.delta.liquidatableFunds], [-2_000_000, -2_000_000, -2_000_000])
    assert.equal(comparison.proof.actualReplay && comparison.proof.alternativeReplay && comparison.proof.sourceUnchanged, true)
    const copy = client.read()
    assert.equal(copy?.status, 'supported-final')
    copy.comparison.delta.cash = 42
    assert.notDeepEqual(copy, client.read())
  } finally { client.dispose() }
  assert.equal(client.read(), null)
  assert.equal(terminated, 1)
})

test('generalized client abort and deadline terminate pending Workers and discard late responses', async () => {
  for (const cancel of [true, false]) {
    const abort = new AbortController()
    let terminated = 0
    const port: Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'> = {
      onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { terminated++ },
    }
    const client = createDecisionClient(abort.signal, () => port, cancel ? 35_000 : 5)
    const pending = client.request({ kind: 'catalog', text: 'unused', scenario: 'course' })
    const late = port.onmessage
    if (cancel) abort.abort()
    await assert.rejects(pending, { name: 'AbortError', message: cancel ? 'decision-worker-cancelled' : 'decision-worker-timeout' })
    late?.call(port as unknown as Worker, { data: { id: 1, result: { status: 'catalog', decisions: [] } } } as MessageEvent)
    assert.equal(client.read(), null)
    assert.equal(terminated, 1)
    assert.equal(port.onmessage, null)
  }
})

test('generalized client ignores foreign response IDs and rejects numbers outside a terminal comparison', async () => {
  let port!: Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>
  let terminated = 0
  const client = createDecisionClient(new AbortController().signal, () => port = {
    onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { terminated++ },
  })
  const pending = client.request({ kind: 'catalog', text: 'unused', scenario: 'bank' })
  port.onmessage?.call(port as unknown as Worker, { data: { id: 99, result: { status: 'catalog', decisions: [] } } } as MessageEvent)
  assert.equal(client.read(), null)
  port.onmessage?.call(port as unknown as Worker, { data: { id: 1, result: { status: 'blocked', reason: 'fake', comparison: { delta: { cash: 42 } } } } } as MessageEvent)
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(client.read(), null)
  assert.equal(terminated, 1)
})

for (const kind of ['stocks', 'bonds', 'business', 'advanced'] as const) {
  test(kind + ' independent fixture uses mock-selected IDs, explicit follow-ups and the existing native Worker', { timeout: 90_000 }, async () => {
    const signal = new AbortController().signal
    let terminated = 0
    const client = createDecisionClient(signal,
      () => workerPort(new URL('./decision.worker.ts', import.meta.url), () => terminated++))
    try {
      const text = multiAssetFixture(kind)
      const catalog = await client.request({ kind: 'catalog', text, scenario: kind })
      assert.equal(catalog.status, 'catalog')
      const choice = catalog.decisions[0], sequence = choice.decisionId.split(':')[1]
      const questions = { stocks: 'bỏ mua cổ phiếu', bonds: 'bỏ mua trái phiếu', business: 'bỏ mua cơ sở', advanced: 'học khóa nâng cao' }
      const proposal = await mockGemini.propose({ question: `Nếu tôi ${questions[kind]} tại quyết định ${sequence} thì sao?`, catalog: catalog.decisions }, signal)
      assert.deepEqual(proposal, { decisionId: choice.decisionId, alternativeId: choice.alternativeId })
      let result = await client.request({ kind: 'create', selection: choice }), count = 0
      while (result.status === 'needs-followup') {
        assert(++count <= 8)
        assert.equal('comparison' in client.read()!, false)
        result = await client.request({ kind: 'followup', choice: { id: result.followUp.id, optionId: 'skip' } })
      }
      assert.equal(result.status, 'supported-final', 'reason' in result ? result.reason : 'comparison required')
      assert(count > 0)
      assert(result.comparison.proof.actualReplay && result.comparison.proof.alternativeReplay)
    } finally { client.dispose() }
    assert.equal(client.read(), null)
    assert.equal(terminated, 1)
  })
}

test('paged native Worker revokes previous parameters and failed probes before accepting a fresh exact selection', { timeout: 90_000 }, async () => {
  let terminated = 0
  const client = createDecisionClient(new AbortController().signal,
    () => workerPort(new URL('./decision.worker.ts', import.meta.url), () => terminated++))
  try {
    const text = multiAssetFixture('stocks', 'skip')
    const history = await client.request({ kind: 'catalog', text, scenario: 'stocks', query: { mode: 'history', offset: 0, limit: 1 } })
    assert.equal(history.status, 'catalog-page')
    assert.equal(history.page.history.length, 1)
    const sequence = history.page.history[0].sequence
    const query = { mode: 'alternatives' as const, sequence, offset: 0, parameters: { operation: 'buy' as const, symbolId: 'CMG', amount: 1_234_567 } }
    const first = await client.request({ kind: 'catalog', scenario: 'stocks', query })
    assert.equal(first.status, 'catalog-page')
    assert.equal(first.page.decisions.length, 1)
    const old = first.page.decisions[0]
    const next = await client.request({ kind: 'catalog', scenario: 'stocks', query: { ...query, parameters: { ...query.parameters, amount: 7_250_000 } } })
    assert.equal(next.status, 'catalog-page')
    assert.equal((await client.request({ kind: 'create', selection: old })).status, 'blocked')
    const invalid = await client.request({ kind: 'catalog', scenario: 'stocks', query: { ...query, offset: -1 } })
    assert.equal(invalid.status, 'blocked')
    assert.equal((await client.request({ kind: 'create', selection: next.page.decisions[0] })).status, 'blocked')
    const fresh = await client.request({ kind: 'catalog', scenario: 'stocks', query })
    assert.equal(fresh.status, 'catalog-page')
    const result = await client.request({ kind: 'create', selection: fresh.page.decisions[0] })
    assert.equal(result.status, 'supported-final')
    assert(result.comparison.proof.alternativeReplay)
  } finally { client.dispose() }
  assert.equal(client.read(), null)
  assert.equal(terminated, 1)
})
