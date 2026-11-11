import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { reliabilityCases, reliabilityHistory } from '../../../../scripts/diagnostics/what-if-reliability-fixtures.ts'
import { saveGameLocally } from '../../../../src/game/saved-game.ts'
import { serializeLog } from '../../../../src/game/log.ts'
import { prepareGoldRequest } from '../endgame-whatif-gold-identity.ts'
import { createGoldContinuation } from '../endgame-whatif-gold-resume.ts'
import { createDecisionReplay, listDecisionPage } from './decision-replay.ts'

const options = { maxMilliseconds: 30_000 }
function packedDigest(state: ReturnType<typeof reliabilityHistory>['state']) {
  let hash = ''
  assert(saveGameLocally(state, { setItem: (_key, value) => { hash = createHash('sha256').update(value).digest('hex') } }))
  return hash
}

for (const fixture of reliabilityCases) test(`reliability ${fixture.kind}: new engine history verifies a separate fork and preserves source/save`, { timeout: 75_000 }, async () => {
  const { state, text } = reliabilityHistory(fixture.seed, fixture.sales, fixture.goldSale)
  const saveBefore = packedDigest(state)
  if (fixture.kind === 'gold') {
    const handle = await createGoldContinuation(await prepareGoldRequest(text, fixture.sequence, options), options)
    const pending = handle.result
    assert.equal(pending.status, 'needs-followup', 'reason' in pending ? pending.reason : pending.status)
    assert.equal(pending.blocker.command.sequence, fixture.followUps[0])
    assert(!('delta' in pending))
    const result = await handle.resume({ continuation: pending.continuation, blocker: pending.blocker, choice: pending.blocker.choices[0].action }, options)
    assert.equal(result.status, 'supported-final', 'reason' in result ? result.reason : result.status)
    assert.equal(result.proof.reconstruction.independentAlternative, 1)
    assert.equal(result.proof.actualReplay && result.proof.alternativeReplay && result.proof.sourceUnchanged, true)
  } else {
    const { kind, sequence, parameters } = fixture
    const page = await listDecisionPage(text, kind, { mode: 'alternatives', sequence, offset: 0, ...(parameters ? { parameters } : {}) }, options)
    const selection = page.decisions.find(choice => parameters || choice.alternativeId === fixture.alternativeId)
    assert(selection)
    if (kind === 'advanced') assert(text.length > 19_800_000 && text.length <= 20_000_000)
    if (kind === 'bonds') {
      assert.equal(state.bondLots.length, 4)
      assert.deepEqual(page.controls?.lots.map(lot => lot.id), ['bond-3', 'bond-4'])
    }
    if (kind === 'stocks') {
      assert.deepEqual(Object.keys(state.stockHoldings).sort(), ['FPT', 'VCB'])
      assert(state.portfolio.business > 0 && state.bondLots.length > 1 && state.deposits.length > 1)
    }
    const handle = await createDecisionReplay(text, selection, options)
    try {
      let result = handle.result, prior: string | undefined
      for (const sequence of fixture.followUps) {
        assert.equal(result.status, 'needs-followup', 'reason' in result ? result.reason : result.status)
        assert.equal(result.followUp.sequence, sequence)
        assert(!('comparison' in result))
        if (prior) assert.equal((await handle.resume({ id: prior, optionId: 'skip' }, options)).status, 'blocked')
        prior = result.followUp.id
        result = await handle.resume({ id: prior, optionId: 'skip' }, options)
      }
      assert.equal(result.status, 'supported-final', 'reason' in result ? result.reason : result.status)
      const { proof } = result.comparison
      assert.equal(proof.actualReplay && proof.alternativeReplay && proof.sourceUnchanged, true)
      assert.match(proof.alternativeExportHash, /^[a-f0-9]{64}$/)
    } finally { handle.dispose() }
  }
  assert.equal(serializeLog(state), text)
  assert.equal(packedDigest(state), saveBefore)
})

test('engine-generated history over the source limit and a consistently forged command both fail closed', { timeout: 30_000 }, async () => {
  const oversized = reliabilityHistory('EG3-AI-08-MIXED-9', 9)
  assert(oversized.text.length > 20_000_000)
  await assert.rejects(listDecisionPage(oversized.text, 'course', { mode: 'history', offset: 0 }, options), /source-size/)
  const { text } = reliabilityHistory('EG3-AI-08-MIXED-3', 3)
  const source = JSON.parse(text)
  const purchase = source.entries.findIndex((entry: { action?: { kind: string; asset?: string } }) => entry.action?.kind === 'buy' && entry.action.asset === 'bonds')
  source.entries[purchase].action.amount++
  source.state.log[purchase].action.amount++
  const tampered = JSON.stringify(source)
  await assert.rejects(listDecisionPage(tampered, 'bank', { mode: 'history', offset: 0 }, options), /actual-prefix-mismatch/)
})

test('new Gold history with a full sale at START remains limited without numeric publication', async () => {
  const { text } = reliabilityHistory('EG3-AI-08-MIXED-5', 3)
  const { result } = await createGoldContinuation(await prepareGoldRequest(text, 45, options), options)
  assert.equal(result.status, 'limited')
  assert.match(result.reason, /illegal-recorded-action/)
  assert(!('delta' in result))
})
