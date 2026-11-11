import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { multiAssetFixture } from '../../../../scripts/diagnostics/what-if-multi-asset-fixtures.ts'
import { flexibleBondFixture } from '../../../../scripts/diagnostics/what-if-flexible-fixtures.ts'
import { saveGameLocally } from '../../../../src/game/saved-game.ts'
import { parseHistory } from '../endgame-whatif-identity.ts'
import { createDecisionReplay, listDecisionPage } from './decision-replay.ts'
import type { DecisionParameters, WhatIfDecision } from './orchestrator.ts'
import { parameterAlternativeId, parameterQuestion } from './orchestrator.ts'
import { validateProviderRequest } from '../../../../src/ai/what-if/contracts.ts'
import { mockGemini } from './mock-gemini.ts'

const options = () => ({ maxMilliseconds: 30_000 })
const archived = (name: string) => gunzipSync(readFileSync(`docs/playtests/core-mvp-b18-multi-course/${name}.json.gz`)).toString()
async function verified(text: string, kind: Exclude<WhatIfDecision['kind'], 'gold'>, sequence: number, parameters: DecisionParameters) {
  const source = parseHistory(text), before = JSON.stringify(source.state)
  let packed = '', after = ''
  assert(saveGameLocally(source.state, { setItem: (_key, value) => { packed = value } }))
  const page = await listDecisionPage(text, kind, { mode: 'alternatives', sequence, offset: 0, parameters }, options())
  assert.equal(page.decisions.length, 1)
  const choice = page.decisions[0]
  validateProviderRequest({ operation: 'propose', question: parameterQuestion(choice), catalog: page.decisions })
  assert.deepEqual(await mockGemini.propose({ question: parameterQuestion(choice), catalog: page.decisions }, new AbortController().signal),
    { decisionId: choice.decisionId, alternativeId: choice.alternativeId })
  const handle = await createDecisionReplay(text, choice, options())
  try {
    let result = handle.result, count = 0
    while (result.status === 'needs-followup') {
      assert(++count <= 8)
      assert.equal('comparison' in result, false)
      result = await handle.resume({ id: result.followUp.id, optionId: 'skip' }, options())
    }
    assert.equal(result.status, 'supported-final', 'reason' in result ? result.reason : 'comparison required')
    assert(result.comparison.proof.actualReplay && result.comparison.proof.alternativeReplay && result.comparison.proof.sourceUnchanged)
    assert.equal(result.comparison.lap, 4)
    assert.equal(JSON.stringify(source.state), before)
    assert(saveGameLocally(source.state, { setItem: (_key, value) => { after = value } }))
    assert.equal(after, packed)
  } finally { handle.dispose() }
  return choice
}

test('filtered history and a custom non-first-symbol budget return only native-probed alternatives', async () => {
  const text = multiAssetFixture('stocks', 'skip')
  const history = await listDecisionPage(text, 'stocks', { mode: 'history', offset: 0, limit: 1 })
  assert.equal(history.history.length, 1)
  const page = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence: history.history[0].sequence,
    offset: 0, parameters: { operation: 'buy', symbolId: 'CMG', amount: 1_234_567 } })
  assert.equal(page.decisions.length, 1)
  assert.deepEqual(page.decisions[0].parameters, { operation: 'buy', symbolId: 'CMG', amount: 1_234_567 })
  const unset = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence: history.history[0].sequence, offset: 0 })
  assert.deepEqual(unset.decisions, [])
})

test('every native stock symbol and budgets below and above five million survive independent replay', async () => {
  const text = multiAssetFixture('stocks', 'skip')
  const history = await listDecisionPage(text, 'stocks', { mode: 'history', offset: 0, limit: 1 }, options())
  const sequence = history.history[0].sequence
  const page = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence, offset: 0 }, options())
  assert.deepEqual(page.controls!.symbols, ['FPT', 'CMG', 'VCB', 'TCB', 'HPG', 'BMP'])
  for (const [index, symbolId] of page.controls!.symbols.entries()) {
    await verified(text, 'stocks', sequence, { operation: 'buy', symbolId, amount: index % 2 ? 7_250_000 : 1_234_567 })
  }
})

test('native stock partial sales work and a sale of an unowned symbol is excluded', async () => {
  const text = multiAssetFixture('stocks', 'hold'), source = parseHistory(text)
  const entry = source.entries.find(row => row.decisionId === 'skip' && row.eventId === 'stocks' && row.before.portfolio.stocks > 0)!
  assert(entry)
  await verified(text, 'stocks', entry.sequence, { operation: 'sell', symbolId: 'FPT', amount: 1_000_000 })
  const invalid = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence: entry.sequence, offset: 0,
    parameters: { operation: 'sell', symbolId: 'CMG', amount: 1_000_000 } }, options())
  assert.deepEqual(invalid.decisions, [])
})

test('Bank exposes all native terms with variable principals and historical deposits remain selectable', async () => {
  const text = archived('frozen-screen-cash-roi')
  for (const term of [1, 2, 3] as const) await verified(text, 'bank', 36, { operation: 'deposit', amount: 1_000_000, term })
  await verified(text, 'bank', 36, { operation: 'deposit', amount: 7_250_000, term: 2 })
  const existing = archived('frozen-holdout-diversified-roi')
  const history = await listDecisionPage(existing, 'bank', { mode: 'history', offset: 0 }, options())
  const deposits = parseHistory(existing).entries.filter(row => row.action?.kind === 'deposit')
  assert(deposits.length > 0)
  assert(history.history.some(row => row.sequence === deposits[0].sequence))
  await verified(existing, 'bank', deposits[0].sequence, { operation: 'deposit', amount: 1_234_567, term: 2 })
})

test('both native bond issuers accept multiple budgets and distinct lots accept partial sales', async () => {
  const text = multiAssetFixture('bonds', 'skip')
  const history = await listDecisionPage(text, 'bonds', { mode: 'history', offset: 0 }, options())
  for (const issuerId of ['an-tam', 'but-pha']) for (const amount of [1_000_000, 7_250_000]) {
    await verified(text, 'bonds', history.history[0].sequence, { operation: 'buy', issuerId, amount })
  }
  const lots = await flexibleBondFixture()
  const page = await listDecisionPage(lots.text, 'bonds', { mode: 'alternatives', sequence: lots.sequence, offset: 0 }, options())
  assert.deepEqual(page.controls!.lots.map(lot => lot.id), ['bond-1', 'bond-2'])
  for (const lotId of ['bond-1', 'bond-2']) await verified(lots.text, 'bonds', lots.sequence, { operation: 'sell', lotId, amount: 750_000 })
  const invalid = await listDecisionPage(lots.text, 'bonds', { mode: 'alternatives', sequence: lots.sequence, offset: 0,
    parameters: { operation: 'sell', lotId: 'bond-99', amount: 1_000 } }, options())
  assert.deepEqual(invalid.decisions, [])
})

test('history and alternative pages keep bounded guards and never silently truncate a selection', async () => {
  const text = multiAssetFixture('stocks', 'skip')
  const first = await listDecisionPage(text, 'stocks', { mode: 'history', offset: 0, limit: 1 }, options())
  assert(first.total > 1)
  assert.equal(first.nextOffset, 1)
  const second = await listDecisionPage(text, 'stocks', { mode: 'history', offset: first.nextOffset, limit: 1 }, options())
  assert(second.history[0].sequence > first.history[0].sequence)
  const business = multiAssetFixture('business', 'hold')
  const history = await listDecisionPage(business, 'business', { mode: 'history', offset: 0 }, options())
  const page = await listDecisionPage(business, 'business', { mode: 'alternatives', sequence: history.history.at(-1)!.sequence, offset: 0, limit: 1 }, options())
  assert(page.total > 1)
  assert.equal(page.nextOffset, 1)
  for (const query of [{ mode: 'history', offset: -1 }, { mode: 'history', offset: 0, limit: 17 },
    { mode: 'history', offset: 501 }, { mode: 'history', offset: 0, rawState: {} }]) {
    await assert.rejects(listDecisionPage(text, 'stocks', query as Parameters<typeof listDecisionPage>[2]))
  }
})

test('dynamic parameters and their canonical IDs are closed-schema and cannot be tampered independently', async () => {
  const parameters = { operation: 'buy', symbolId: 'CMG', amount: 1_234_567 } as const
  const choice: WhatIfDecision = { kind: 'stocks', decisionId: 'stocks:7', alternativeId: parameterAlternativeId('stocks', parameters)!, lap: 1, turn: 2, parameters }
  const request = { operation: 'propose', question: parameterQuestion(choice), catalog: [choice] }
  validateProviderRequest(request)
  for (const bad of [{ ...choice, alternativeId: null }, { ...choice, parameters: { ...parameters, amount: -1 } },
    { ...choice, parameters: { ...parameters, amount: 1.5 } }, { ...choice, parameters: { ...parameters, symbolId: 'VCB' } },
    { ...choice, parameters: { ...parameters, rawSave: {} } }, { ...choice, parameters: { operation: 'deposit', amount: 1, term: 4 } },
    { ...choice, parameters: { ...parameters, amount: Number.MAX_SAFE_INTEGER + 1 } }]) {
    assert.throws(() => validateProviderRequest({ ...request, catalog: [bad] }))
  }
  const text = multiAssetFixture('stocks', 'skip')
  const history = await listDecisionPage(text, 'stocks', { mode: 'history', offset: 0 }, options())
  const page = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence: history.history[0].sequence, offset: 0, parameters }, options())
  const handle = await createDecisionReplay(text, { ...page.decisions[0], parameters: { ...parameters, amount: 2_000_000 } }, options())
  assert.equal(handle.result.status, 'blocked')
  assert.equal('comparison' in handle.result, false)
  handle.dispose()
  const overfunded = await listDecisionPage(text, 'stocks', { mode: 'alternatives', sequence: history.history[0].sequence,
    offset: 0, parameters: { ...parameters, amount: Number.MAX_SAFE_INTEGER } }, options())
  assert.deepEqual(overfunded.decisions, [])
})

test('mock asks for explicit numeric and target selection instead of guessing a parameter', async () => {
  const make = (symbolId: string): WhatIfDecision => {
    const parameters = { operation: 'buy', symbolId, amount: 1_234_567 } as const
    return { kind: 'stocks', decisionId: 'stocks:7', alternativeId: parameterAlternativeId('stocks', parameters)!, lap: 1, turn: 2, parameters }
  }
  const catalog = [make('FPT'), make('CMG')], signal = new AbortController().signal
  for (const question of ['Mua cổ phiếu', 'Mua cổ phiếu CMG', 'Mua cổ phiếu số tiền 1234567']) {
    const reply = await mockGemini.propose({ question, catalog }, signal)
    assert(!('decisionId' in (reply as object)))
  }
  assert.deepEqual(await mockGemini.propose({ question: parameterQuestion(catalog[1]), catalog }, signal),
    { decisionId: 'stocks:7', alternativeId: catalog[1].alternativeId })
  const repeated = [catalog[1], { ...catalog[1], decisionId: 'stocks:8' }]
  assert.deepEqual(await mockGemini.propose({ question: 'Mua cổ phiếu CMG số tiền 1234567', catalog: repeated }, signal), { status: 'ambiguous' })
})

test('Course page exposes Basic and Advanced without weakening native repeat-course guards', async () => {
  const text = multiAssetFixture('advanced')
  const history = await listDecisionPage(text, 'course', { mode: 'history', offset: 0 }, options())
  const page = await listDecisionPage(text, 'course', { mode: 'alternatives', sequence: history.history[0].sequence, offset: 0 }, options())
  assert.deepEqual(page.decisions.map(choice => choice.alternativeId), ['course-basic', 'course-advanced'])
  const choice = page.decisions.find(choice => choice.alternativeId === 'course-advanced')!
  const handle = await createDecisionReplay(text, choice, options())
  assert.equal(handle.result.status, 'needs-followup')
  const pending = handle.result
  assert.equal(pending.status, 'needs-followup')
  const result = await handle.resume({ id: pending.followUp.id, optionId: 'skip' }, options())
  assert.equal(result.status, 'supported-final')
  handle.dispose()
})
