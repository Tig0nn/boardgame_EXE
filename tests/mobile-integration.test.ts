import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, decide, roll, transact, fundPayment } from '../src/game/engine.ts'
import { createPlayerGame } from '../src/game/new-game.ts'
import { EVENTS } from '../src/data/events.ts'
import { fundingSources } from '../src/game/transactions.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { createMobileGame, createMobileSession, movementPath } from '../mobile_app/src/game/session.ts'
import type { MobileCommand } from '../mobile_app/src/game/session.ts'
import type { GameState } from '../src/game/types.ts'

function webStep(s: GameState, command: MobileCommand): GameState {
  switch (command.type) {
    case 'advance': return advance(s)
    case 'roll': return roll(s)
    case 'choose': return decide(s, command.id)
    case 'trade': return transact(s, command.action)
    case 'fund': return fundPayment(s, command.source, command.amount, command.lotId)
  }
}

for (const seed of ['mobile-parity-1', 'mobile-parity-2', 'mobile-parity-3']) {
  test(`mobile controller matches web after every decision and replays four laps: ${seed}`, () => {
    let web = createPlayerGame(seed, 10_000_000, 2, 'experimental-b')
    const session = createMobileSession(createMobileGame(seed, 10_000_000, 2))
    assert.deepEqual(session.getSnapshot(), web)
    assert.equal(web.boardLayout, 'C20')
    assert.equal(web.totalLaps, 4)
    for (let steps = 0; web.phase !== 'finished' && steps < 400; steps++) {
      const command: MobileCommand = web.phase === 'rolling' ? { type: 'roll' }
        : web.phase === 'event' ? web.eventId === 'bank' && web.portfolio.cash >= 5_000_000
          ? { type: 'trade', action: { kind: 'deposit', amount: 5_000_000, term: 2 } }
          : web.eventId === 'stocks' && web.portfolio.cash >= 5_000_000
            ? { type: 'trade', action: { kind: 'buy', asset: 'stocks', amount: 5_000_000, symbolId: web.market.stocks[0].id, completeEncounter: true } }
            : web.eventId === 'business' && !web.business.capital && web.portfolio.cash >= 20_000_000
              ? { type: 'trade', action: { kind: 'buy', asset: 'business', amount: 20_000_000 } }
              : web.eventId === 'business' && web.business.capital && web.businessPurchaseTurn !== web.turn && web.portfolio.cash >= 5_000_000
                && !web.log.some(e => e.turn === web.turn && e.decisionId === 'upgrade-business')
                ? { type: 'trade', action: { kind: 'upgrade', asset: 'business', amount: 5_000_000, customerPreferenceId: web.customerPreferenceId } }
                : { type: 'choose', id: EVENTS.find(e => e.id === web.eventId)!.options.find(o => o.id === 'skip')?.id ?? EVENTS.find(e => e.id === web.eventId)!.options[0].id }
          : web.phase === 'funding' ? (() => {
            const source = fundingSources(web)[0]
            const lot = web.deposits.find(l => l.status === 'active')
            return { type: 'fund' as const, source, amount: source === 'savings' ? lot!.principal : source === 'debt' ? Math.min(web.pendingPayment!.remaining, web.borrowingLimit - web.portfolio.debt) : web.portfolio[source], lotId: lot?.id }
          })() : { type: 'advance' }
      const before = session.getSnapshot()
      assert.equal(session.dispatch(command, before), true)
      assert.equal(session.dispatch(command, before), false, 'stale repeated tap is rejected')
      web = webStep(web, command)
      assert.deepEqual(session.getSnapshot(), web, `state mismatch at step ${steps}`)
      if (command.type === 'roll') {
        const path = movementPath(before, web)
        assert.equal(path.length, web.dice)
        assert.equal(path.at(-1), web.position)
      }
    }
    assert.equal(web.phase, 'finished')
    assert.equal(web.summaries.length, 4)
    assert.deepEqual(replayGameLog(JSON.parse(serializeLog(session.getSnapshot()))), web)
  })
}

test('animation path crosses START without mutating engine or drawing randomness', () => {
  const s = { ...createMobileGame('movement', 0), phase: 'rolling' as const, position: 18 }
  const after = { ...s, position: 3, dice: 5 }
  const saved = structuredClone(after)
  assert.deepEqual(movementPath(s, after), [19, 0, 1, 2, 3])
  assert.deepEqual(after, saved)
})
