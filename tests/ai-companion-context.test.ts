import test from 'node:test'
import assert from 'node:assert/strict'
import { decide, fundPayment } from '../src/game/engine.ts'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { parseRepairContext } from '../src/ai/companion/contracts.ts'
import { deepFreeze, revealedRepair, continueFixtureGame } from './helpers/companion.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'

const identity = { sessionEpoch: 'test-session', revision: 1 }

test('repair projector reads a real revealed encounter without mutation or hidden data', () => {
  const game = deepFreeze(revealedRepair()), before = JSON.stringify(game)
  const context = buildRepairContext(game, identity)
  assert.equal(JSON.stringify(game), before)
  assert.equal(context.decision.encounterSequence, game.log.at(-1)!.sequence)
  assert.deepEqual(parseRepairContext(context), context)
  assert.doesNotMatch(JSON.stringify(context), /"(?:seed|rng|market|log|bondCredit|debug)"\s*:/)
  assert.equal(JSON.stringify(context).includes(game.seed), false)
  assert.deepEqual(context.options.map(o => [o.optionId, o.costNowVnd, o.obligationAddedVnd, o.totalCommittedCostVnd]), [
    ['full', 4_000_000, 0, 4_000_000], ['temporary', 1_000_000, 4_000_000, 5_000_000],
  ])
  for (const option of context.options) {
    const after = decide(game, option.optionId)
    assert.equal(option.cashAfterImmediateVnd, after.portfolio.cash)
    assert.equal(option.obligationsAfterImmediateVnd, after.obligations)
  }
})

for (const cash of [500_000, 0, 1_000_000, 4_000_000]) test(`repair cash=${cash}: funding is not a forbidden option or an applied obligation`, () => {
  const game = revealedRepair()
  game.portfolio.cash = cash
  game.obligations = 2_000_000
  const context = buildRepairContext(game, identity)
  for (const quote of context.options) {
    const after = decide(game, quote.optionId)
    assert.equal(quote.allowed, true)
    assert.equal(quote.cashAfterImmediateVnd, after.portfolio.cash)
    assert.equal(quote.fundingShortfallVnd, after.pendingPayment?.remaining ?? 0)
    assert.equal(quote.obligationsAfterImmediateVnd, after.obligations)
    assert.equal(quote.obligationsAfterResolutionVnd, game.obligations + quote.obligationAddedVnd)
    if (after.phase === 'funding') {
      const resolved = fundPayment(after, 'debt', after.pendingPayment!.remaining)
      assert.equal(resolved.obligations, quote.obligationsAfterResolutionVnd)
      assert.equal(resolved.portfolio.debt, quote.fundingShortfallVnd)
    }
  }
})

test('pending funding, wrong event, missing reveal and unsupported profile do not project advice', () => {
  const game = revealedRepair()
  game.portfolio.cash = 0
  assert.throws(() => buildRepairContext(decide(game, 'temporary'), identity), { code: 'DECISION_UNAVAILABLE' })
  assert.throws(() => buildRepairContext({ ...game, eventId: 'medical' }, identity), { code: 'DECISION_UNAVAILABLE' })
  assert.throws(() => buildRepairContext({ ...game, log: [] }, identity), { code: 'DECISION_UNAVAILABLE' })
  assert.throws(() => buildRepairContext({ ...game, gameplayProfile: 'core-mvp-b18-v1' }, identity), { code: 'UNSUPPORTED_PROFILE' })
})

test('final lap repair obligation is paid at the final START; projected advice preserves exact replay', () => {
  const game = revealedRepair(4), before = structuredClone(game)
  const quote = buildRepairContext(deepFreeze(game), identity).options.find(option => option.optionId === 'temporary')!
  assert.equal(quote.dueLap, 4)
  assert.deepEqual(game, before)
  let after = decide(game, 'temporary')
  for (let step = 0; after.phase !== 'finished' && step < 100; step++) after = continueFixtureGame(after)
  assert.equal(after.phase, 'finished')
  const payment = after.log.find(entry => entry.sequence > game.log.at(-1)!.sequence && entry.kind === 'schedule'
    && entry.before.obligations > 0 && entry.after.obligations === 0)!
  assert.ok(payment)
  assert.equal(payment.before.obligations, quote.obligationsAfterResolutionVnd)
  assert.equal(payment.after.obligations, 0)
  assert.ok(after.summaries[3].lines.some(line => line.label === 'Nghĩa vụ đã hẹn' && line.amount === -quote.obligationsAfterResolutionVnd))
  assert.deepEqual(replayGameLog(JSON.parse(serializeLog(after))), after)
})
