import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { prepareCourseRequest, simulateCourseBasic } from './endgame-whatif-course-basic.ts'

const source = () => gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-320-basic-first.json.gz')).toString('utf8')

test('explicit Basic8 to engine skip reaches completed4 with independent replay and signed selectors', async () => {
  const text = source(), request = await prepareCourseRequest(text, 8)
  const result = await simulateCourseBasic(request)
  assert.equal(result.status, 'supported-final')
  if (result.status !== 'supported-final') return
  assert.equal(result.comparability, 'same-completed-horizon')
  assert.equal(result.actual.cash, 94_000_000)
  assert.equal(result.alternative.cash, 92_000_000)
  assert.equal(result.delta.cash, -2_000_000)
  assert.equal(result.delta.totalWorth, -2_000_000)
  assert.equal(result.delta.liquidatableFunds, -2_000_000)
  assert.equal(result.actual.won, true)
  assert.equal(result.alternative.won, true)
  assert.equal(result.proof.alternativeReplay, true)
  assert.equal(result.proof.actualReplay, true)
  assert.equal(request.source, text)
  assert.equal(source(), text)
})

test('wrong source, branch and policy identities fail closed without final numeric fields', async () => {
  for (const field of ['sourceHash', 'branch', 'policy'] as const) {
    const request = await prepareCourseRequest(source(), 8)
    const tampered = { ...request, identity: { ...request.identity, [field]: 'wrong' } }
    const result = await simulateCourseBasic(tampered)
    assert.equal(result.status, 'blocked')
    assert.equal('delta' in result, false)
  }
})

test('malformed source is blocked as invalid input rather than an internal error', async () => {
  const request = await prepareCourseRequest(source(), 8)
  const result = await simulateCourseBasic({ ...request, source: '{broken-json' })
  assert.equal(result.status, 'blocked')
  assert.equal('delta' in result, false)
})
import type { GameState } from '../../../src/game/types.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { advance, decide, transact, roll, fundPayment, canChoose } from '../../../src/game/engine.ts'
import { createMobileSession } from './session.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { snapshot } from '../../../src/game/state.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { boardFor } from '../../../src/data/board.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { WorkBudget, EndgameRejected } from './endgame-whatif-contract.ts'
import { parseHistory, commandIdentity } from './endgame-whatif-identity.ts'
import { replayHistory, advanceOnce } from './endgame-whatif-replay.ts'
import { forkCourseBasic } from './endgame-whatif-course-basic.ts'
import { continueRecorded, finalAdvancePair, continuationFacts } from './endgame-whatif-continuation.ts'
import { completedFour, comparableEndings, endingMetrics, signedMetrics } from './endgame-whatif-comparison.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'
import { captureDataIntegrity } from './endgame-whatif-integrity.ts'

const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const fixture = () => JSON.parse(source())
const mutatedSource = (change: (data: ReturnType<typeof fixture>) => void) => { const data = fixture(); change(data); return JSON.stringify(data) }
const noFinal = (result: object) => { assert.equal('delta' in result, false); assert.equal('comparability' in result, false) }
let actualProof: ReturnType<typeof replayHistory> | undefined
const verified = () => actualProof ??= replayHistory(parseHistory(source()), new WorkBudget(), 8)

for (const [name, change] of [
  ['wrong schema', (d: ReturnType<typeof fixture>) => { d.schemaVersion = 6 }],
  ['wrong profile', (d: ReturnType<typeof fixture>) => { d.state.gameplayProfile = 'core-mvp-b18-v1' }],
  ['mixed config', (d: ReturnType<typeof fixture>) => { d.financialConfig.RULES.goal++ }],
  ['corrupt intermediate snapshot', (d: ReturnType<typeof fixture>) => { d.entries[20].before.portfolio.cash++; d.state.log = d.entries }],
  ['corrupt final Actual', (d: ReturnType<typeof fixture>) => { d.state.portfolio.cash++ }],
  ['non-contiguous log', (d: ReturnType<typeof fixture>) => { d.entries[15].sequence = 999; d.state.log = d.entries }],
  ['missing explicit Basic', (d: ReturnType<typeof fixture>) => { d.entries[7].decisionId = 'skip'; d.state.log = d.entries }],
] as const) {
  test('source boundary: ' + name, async () => {
    const text = mutatedSource(change)
    let request: Awaited<ReturnType<typeof prepareCourseRequest>>
    try { request = await prepareCourseRequest(text, 8) }
    catch (error) { assert(error instanceof EndgameRejected); return }
    const result = await simulateCourseBasic(request)
    assert(['blocked', 'limited'].includes(result.status)); noFinal(result)
  })
}

test('Advanced/Gold/Bank decision cannot be selected as approved policy', async () => {
  for (const sequence of [11, 14, 17]) await assert.rejects(prepareCourseRequest(source(), sequence), /explicit-basic-required/)
})

test('decision/config/engine identity mismatch is rejected, even when source bytes are unchanged', async () => {
  const original = await prepareCourseRequest(source(), 8)
  for (const request of [
    { ...original, identity: { ...original.identity, configHash: '0'.repeat(64) } },
    { ...original, identity: { ...original.identity, engine: 'other-engine' } },
    { ...original, identity: { ...original.identity, decision: { ...original.identity.decision, turn: 99 } } },
  ]) { const result = await simulateCourseBasic(request); assert.equal(result.status, 'blocked'); noFinal(result) }
})

test('reconstructed pre-state proves both choices legal; invalid Alternative context is refused', async () => {
  const { before, commands } = await verified(); assert(before)
  const entry = commands.find(e => e.sequence === 8)!; assert(canChoose(before, 'course-basic')); assert(canChoose(before, 'skip'))
  const input = serializeLog(before), fork = forkCourseBasic(before, entry, new WorkBudget())
  assert.equal(serializeLog(before), input); assert(sameExternal(fork.actual, fork.alternative))
  assert.equal(fork.actual.portfolio.cash, before.portfolio.cash - 6_000_000)
  assert.equal(fork.alternative.portfolio.cash, before.portfolio.cash)
  assert.equal(fork.actual.recurringIncome - fork.alternative.recurringIncome, 2_000_000)
  const illegal = { ...structuredClone(before), phase: 'rolling' as const }
  assert.equal(canChoose(illegal, 'skip'), false)
  assert.throws(() => forkCourseBasic(illegal, entry, new WorkBudget()), /fork-not-legal/)
})

// Synthetic engine-boundary fixtures below are negative probes, never supported product forks.
function eventState(eventId: string) {
  const s = createMultiCourseGame('EG1A-NEGATIVE-BOUNDARY-v1', 0)
  return { ...s, phase: 'event' as const, eventId, position: boardFor(s).findIndex(tile => tile.type === eventId) }
}
function recordedDecision(s: GameState, id: string) { return decide(s, id).log.findLast(e => e.kind === 'decision')! }
function rollEntry(s: GameState) { return roll(s).log.findLast(e => e.kind === 'roll')! }

for (const reason of ['duplicate-course', 'insufficient-cash'] as const) {
  test('first illegal recorded course action: ' + reason, async () => {
    let a: GameState = eventState('course'), b: GameState = structuredClone(a)
    if (reason === 'duplicate-course') {
      b = decide(b, 'course-advanced'); b = { ...b, phase: 'event', eventId: 'course', turn: 1 }
      a = { ...a, turn: 1 }
    } else b.portfolio.cash = 4_000_000
    const entry = recordedDecision(a, 'course-advanced'), old = serializeLog(b)
    const step = continueRecorded(a, b, entry, new WorkBudget())
    assert.equal(step.ok, false)
    if (step.ok) return
    assert.equal(step.reason, 'illegal-recorded-action'); assert.equal(serializeLog(b), old)
    const identity = (await prepareCourseRequest(source(), 8)).identity
    const facts = await continuationFacts(identity, entry, 4, step.alternative, step.reason)
    assert.equal(facts.command.sequence, entry.sequence); assert.equal(facts.cursor.sourceCommandIndex, 4)
    assert.equal(facts.resumeSupported, false); assert(facts.legalOptions.some(x => x.id === 'skip'))
    assert.equal(facts.legalOptions.some(x => x.id === 'course-advanced'), false)
    assert.equal('portfolio' in facts, false); noFinal(facts)
  })
}

test('recorded asset sale incompatible with holdings stops without changing the command', () => {
  const base = eventState('gold'), bought = transact(base, { kind: 'buy', asset: 'gold', amount: 5_000_000 })
  const a = { ...bought, phase: 'event' as const, eventId: 'gold', turn: 1 }, b = { ...base, turn: 1 }
  const entry = transact(a, { kind: 'sell', asset: 'gold', amount: a.portfolio.gold }).log.at(-1)!
  const original = clean(entry), step = continueRecorded(a, b, entry, new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'illegal-recorded-action')
  assert.deepEqual(entry, original); assert.equal(b.goldUnits, 0)
})

function fundingPair() {
  const base = eventState('course')
  const medical = { ...base, eventId: 'medical', position: 3, portfolio: { ...base.portfolio, cash: 0 } }
  const pending = decide(medical, 'pay')
  assert.equal(pending.phase, 'funding')
  return { base, pending }
}

test('recorded funding no longer needed is a blocker, never a fund-zero replacement', () => {
  const { pending } = fundingPair(), resolved = decide({ ...pending, phase: 'event', eventId: 'medical', pendingPayment: null, portfolio: { ...pending.portfolio, cash: 10_000_000 } }, 'pay')
  const entry = fundPayment(pending, 'debt', pending.pendingPayment!.remaining).log.find(e => e.kind === 'funding')!
  const step = continueRecorded(pending, resolved, entry, new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'funding-no-longer-needed')
})

test('new Alternative pending funding before recorded roll stops before rolling', () => {
  const { pending } = fundingPair(), actual = { ...pending, phase: 'rolling' as const, eventId: null, pendingPayment: null, pendingCost: 0 }
  const step = continueRecorded(actual, pending, rollEntry(actual), new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'new-pending-funding')
})

test('different pending-payment amounts stop even with both phases funding', () => {
  const { pending } = fundingPair(), b = structuredClone(pending); b.pendingPayment!.remaining--
  const entry = fundPayment(pending, 'debt', pending.pendingPayment!.remaining).log.find(e => e.kind === 'funding')!
  const step = continueRecorded(pending, b, entry, new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'funding-requirements-mismatch')
})

for (const field of ['rng', 'market', 'credit', 'time', 'event', 'schedule'] as const) {
  test('F1 blocks exogenous/context mismatch: ' + field, () => {
    const a = eventState('course'), b = structuredClone(a), entry = recordedDecision(a, 'skip')
    if (field === 'rng') b.rng++
    if (field === 'market') b.market.gold.priceHistory[0].priceAfter++
    if (field === 'credit') b.bondCredit!.rng++
    if (field === 'time') b.turn++
    if (field === 'event') b.eventId = 'gold'
    if (field === 'schedule') b.summaries = [{ lap: 1 } as GameState['summaries'][number]]
    const before = clean(b), step = continueRecorded(a, b, entry, new WorkBudget())
    assert.equal(step.ok, false); if (!step.ok) assert(['context-mismatch', 'external-mismatch'].includes(step.reason))
    assert.deepEqual(b, before)
  })
}

test('wrong recorded context and no-progress engine transition cannot be bypassed', () => {
  const a = eventState('course'), entry = recordedDecision(a, 'skip')
  const wrong = { ...entry, before: { ...entry.before, position: (entry.before.position + 1) % 18 } }
  const step = continueRecorded(a, structuredClone(a), wrong, new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'recorded-context-mismatch')
  const unreachable = { ...entry, before: { ...entry.before, phase: 'summary' as const } }
  const noProgress = continueRecorded(a, structuredClone(a), unreachable, new WorkBudget())
  assert.equal(noProgress.ok, false); if (!noProgress.ok) assert.equal(noProgress.reason, 'engine-no-progress')
  assert.throws(() => advanceOnce(a, new WorkBudget()), /engine-no-progress/)
})
async function fullAlternative() {
  const proof = await verified(); assert(proof.before)
  const index = proof.commands.findIndex(e => e.sequence === 8), selected = proof.commands[index], work = new WorkBudget()
  let pair = forkCourseBasic(proof.before, selected, work)
  for (const entry of proof.commands.slice(index + 1)) {
    const step = continueRecorded(pair.actual, pair.alternative, entry, work)
    if (!step.ok) assert.fail(step.reason)
    pair = step
  }
  const terminal = finalAdvancePair(pair.actual, pair.alternative, work)
  if (!terminal.ok) assert.fail(terminal.reason)
  return { ...terminal, proof, beforeFinal: pair.actual }
}

test('independent pre-existing Node replay reproduces the complete Alternative, including four salary consequences', async () => {
  const { actual, alternative, proof, advances } = await fullAlternative()
  assert.deepEqual(clean(actual), clean(proof.final))
  assert.equal(advances, 2)
  const exportText = serializeLog(alternative), replayed = replayGameLog(JSON.parse(exportText))
  assert.deepEqual(JSON.parse(serializeLog(replayed)), JSON.parse(exportText))
  assert.equal(alternative.ownedCourses!.includes('basic'), false)
  assert.equal(actual.ownedCourses!.includes('basic'), true)
  const a = endingMetrics(actual), b = endingMetrics(alternative)
  assert.deepEqual(a.salaryAtStarts.map(x => x.courseBoost), [6_000_000, 6_000_000, 6_000_000, 6_000_000])
  assert.deepEqual(b.salaryAtStarts.map(x => x.courseBoost), [4_000_000, 4_000_000, 4_000_000, 4_000_000])
  assert.equal(signedMetrics(a, b).cash, -2_000_000)
  assert.equal(alternative.log.at(-1)!.after.phase, 'summary')
  assert.equal(alternative.phase, 'finished')
})

for (const ending of ['insolvent', 'summary-before-final', 'missing-summary', 'duplicate-summary', 'pending-settlement', 'pending-payment', 'wrong-time', 'early-finished'] as const) {
  test('ending comparison refuses ' + ending, async () => {
    const a = (await verified()).final, b = structuredClone(a)
    if (ending === 'insolvent') { b.termination = 'insolvent'; b.lap = 2 }
    if (ending === 'summary-before-final') b.phase = 'summary'
    if (ending === 'missing-summary') b.summaries.pop()
    if (ending === 'duplicate-summary') b.summaries[3].lap = 3
    if (ending === 'pending-settlement') b.settlement = { step: 6, before: snapshot(b), lines: [], rates: {}, incomeTotal: 0, debtPrincipalPaid: 0, fundingNotes: [] }
    if (ending === 'pending-payment') { b.pendingPayment = { origin: 'event', title: 'negative fixture', total: 1, remaining: 1 }; b.pendingCost = 1 }
    if (ending === 'wrong-time') b.turn++
    if (ending === 'early-finished') { b.lap = 2; b.summaries = b.summaries.slice(0, 2) }
    assert.equal(comparableEndings(a, b), false)
  })
}

test('real engine insolvency at a synthetic boundary stops without future salary/market or completed ending', () => {
  const base = eventState('course'), short = { ...base, phase: 'event' as const, eventId: 'medical', position: 3,
    portfolio: { ...base.portfolio, cash: 0, debt: base.borrowingLimit } }
  const insolvent = decide(short, 'pay')
  assert.equal(insolvent.phase, 'finished'); assert.equal(insolvent.termination, 'insolvent')
  const before = serializeLog(insolvent)
  assert.equal(advance(insolvent), insolvent); assert.equal(roll(insolvent), insolvent)
  assert.equal(serializeLog(insolvent), before); assert.equal(completedFour(insolvent), false)
  const normal = { ...short, phase: 'rolling' as const, eventId: null }, entry = rollEntry(normal)
  const step = continueRecorded(normal, insolvent, entry, new WorkBudget())
  assert.equal(step.ok, false); if (!step.ok) assert.equal(step.reason, 'early-insolvency')
})

test('cursor records an already-applied command at first funding divergence, so no future reapply is implied', async () => {
  const base = eventState('course'), a = { ...base, eventId: 'medical', position: 3, portfolio: { ...base.portfolio, cash: 0 } }
  const b = { ...structuredClone(a), portfolio: { ...a.portfolio, cash: 6_000_000 } }, entry = recordedDecision(a, 'pay')
  const step = continueRecorded(a, b, entry, new WorkBudget())
  assert.equal(step.ok, false); if (step.ok) return
  assert.equal(step.reason, 'funding-no-longer-needed'); assert.equal(step.boundary, 'after-command')
  const facts = await continuationFacts((await prepareCourseRequest(source(), 8)).identity, entry, 7, step.alternative, step.reason, step.boundary)
  assert.equal(facts.cursor.sourceCommandIndex, 7); assert.equal(facts.cursor.nextSourceCommandIndex, 8)
  assert.equal(facts.resumeSupported, false); assert.deepEqual(facts.legalOptions, []); noFinal(facts)
})

test('bounded work returns limited at step limit, never a partial final DTO', async () => {
  const request = await prepareCourseRequest(source(), 8)
  const result = await simulateCourseBasic(request, { maxSteps: 1 })
  assert.equal(result.status, 'limited'); if (result.status === 'limited') assert.equal(result.reason, 'step-budget')
  noFinal(result)
  const work = new WorkBudget({ maxSteps: 2 }); work.step(); work.step(); assert.throws(() => work.step(), /step-budget/)
})

test('invalid work bound cannot disable budget', async () => {
  const request = await prepareCourseRequest(source(), 8)
  for (const maxSteps of [0, -1, Infinity, 20_001]) {
    const result = await simulateCourseBasic(request, { maxSteps })
    assert.equal(result.status, 'blocked'); noFinal(result)
  }
})

test('pre-aborted and in-flight cancellation publish no final numbers', async () => {
  const request = await prepareCourseRequest(source(), 8), pre = new AbortController(); pre.abort()
  assert.equal((await simulateCourseBasic(request, { signal: pre.signal })).status, 'cancelled')
  const signal = new AbortController(), timer = setTimeout(() => signal.abort(), 5)
  try { const result = await simulateCourseBasic(request, { signal: signal.signal }); assert.equal(result.status, 'cancelled'); noFinal(result) }
  finally { clearTimeout(timer) }
})

test('exact source/request changes across async verification are rejected before publication', async () => {
  const request = await prepareCourseRequest(source(), 8), timer = setTimeout(() => { request.identity.branch = 'changed-after-start' }, 1)
  try { const result = await simulateCourseBasic(request); assert.equal(result.status, 'blocked'); noFinal(result) }
  finally { clearTimeout(timer) }
})

test('request getters are never invoked and cycles/custom prototypes are rejected', async () => {
  const request = await prepareCourseRequest(source(), 8); let reads = 0
  const getter = { identity: request.identity, get source() { reads++; return request.source } }
  const result = await simulateCourseBasic(getter)
  assert.equal(result.status, 'blocked'); assert.equal(reads, 0); noFinal(result)
  const cycle: { self?: object } = {}; cycle.self = cycle
  assert.throws(() => captureDataIntegrity(cycle), /cyclic-input/)
  assert.throws(() => captureDataIntegrity(Object.create({ inherited: true })), /non-data-input/)
  const object = { nested: { value: 1 } }, current = captureDataIntegrity(object)
  object.nested.value = 2; assert.equal(current(), false)
})

test('source/live session and storage stay unchanged; outputs deterministic across reruns', async () => {
  const request = await prepareCourseRequest(source(), 8), before = clean(request)
  const live = createMobileSession(restoreSavedGame(request.source)), liveBefore = serializeLog(live.getSnapshot())
  let dispatches = 0
  live.dispatch = () => { dispatches++; throw Error('forbidden live dispatch') }
  let writes = 0
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() { writes++; throw Error('forbidden save') } } })
  try {
    const first = await simulateCourseBasic(request), second = await simulateCourseBasic(request)
    assert.equal(first.status, 'supported-final'); assert.deepEqual(second, first); assert.deepEqual(request, before); assert.equal(writes, 0)
    assert.equal('resume' in first, false); assert.equal('state' in first, false)
    assert.equal(dispatches, 0); assert.equal(serializeLog(live.getSnapshot()), liveBefore)
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage') }
})

test('second pre-existing independent engine history is tested by first explicit Basic eligibility, not payoff', async () => {
  const path = 'docs/playtests/core-mvp-b18-multi-course/frozen-shortlist-novice.json.gz'
  const text = gunzipSync(readFileSync(path)).toString('utf8'), history = parseHistory(text)
  const entry = history.entries.find(e => e.kind === 'decision' && e.eventId === 'course' && e.decisionId === 'course-basic')!
  assert(entry); assert.equal(entry.sequence, 52)
  const result = await simulateCourseBasic(await prepareCourseRequest(text, entry.sequence))
  assert.equal(result.status, 'supported-final')
  if (result.status === 'supported-final') { assert.equal(result.proof.alternativeReplay, true); assert.equal(result.endings.actual.lap, 4); assert.equal(result.endings.alternative.lap, 4) }
})
test('corrupted recorded transaction reports source-replay blocked, not an opaque internal error', async () => {
  const d = JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/frozen-shortlist-novice.json.gz')).toString('utf8'))
  const entry = d.entries.find((e: { kind: string }) => e.kind === 'rebalancing')
  assert(entry); entry.action.amount = -1; d.state.log = d.entries
  const result = await simulateCourseBasic(await prepareCourseRequest(JSON.stringify(d), 52))
  assert.equal(result.status, 'blocked'); noFinal(result)
})
test('terminal comparison requires approved profile and rejects a foreign completed4 ending', async () => {
  const a = (await verified()).final, foreign = structuredClone(a)
  foreign.gameplayProfile = 'core-mvp-b18-v1'
  assert.equal(comparableEndings(a, foreign), false)
})
test('parser rejects oversized, cyclic-like JSON depth and non-finite numeric data before identity hashing', () => {
  assert.throws(() => parseHistory('x'.repeat(20_000_001)), /source-size/)
  const deep = fixture(); let nested = deep
  for (let i = 0; i < 70; i++) { nested.extra = {}; nested = nested.extra }
  assert.throws(() => parseHistory(JSON.stringify(deep)), /data-too-deep/)
  const text = source().replace('94000000', '1e400')
  assert.notEqual(text, source())
  assert.throws(() => parseHistory(text), /non-data-input/)
})
test('command identity is a bounded allowlist, not a carrier for arbitrary action payloads', () => {
  const entry = clean(fixture().entries[7])
  entry.kind = 'rebalancing'
  entry.action = { kind: 'buy', asset: 'gold', amount: 1, extraPayload: { rawState: { marker: 'do-not-leak' } } }
  const identity = commandIdentity(entry)
  assert(identity.action); assert.equal('extraPayload' in identity.action, false)
  assert.deepEqual(identity.action, { kind: 'buy', amount: 1, asset: 'gold' })
  assert.equal(JSON.stringify(identity).includes('rawState'), false)
})
test('genuine final START summary input is not a full terminal source and cannot publish final numbers', async () => {
  const { beforeFinal } = await fullAlternative()
  assert.equal(beforeFinal.phase, 'summary')
  assert.equal(beforeFinal.summaries.length, 4)
  const result = await simulateCourseBasic(await prepareCourseRequest(serializeLog(beforeFinal), 8))
  assert.equal(result.status, 'blocked'); if (result.status === 'blocked') assert.equal(result.reason, 'source-not-terminal')
  noFinal(result)
})
test('known action fields also require bounded scalar values before entering a continuation identity', () => {
  const entry = clean(fixture().entries[7]); entry.kind = 'rebalancing'
  entry.action = { kind: 'buy', asset: 'gold', amount: 1, completeEncounter: { rawState: 'not-a-boolean' } }
  assert.throws(() => commandIdentity(entry), /identity-action-invalid/)
})