import assert from 'node:assert/strict'
import test from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { businessOverview, purchasePreview } from '../../../src/game/selectors.ts'
import { currentCustomerPreference } from '../../../src/game/customer-preferences.ts'
import { ECONOMY } from '../../../src/data/config.ts'
import { createMobileSession } from '../../src/game/session.ts'
import { fromLocal, setAmount } from '../src/arena-model.ts'

test('business artwork details project canonical values without changing a state, including after purchase', () => {
  const controller = createMobileSession(createMultiCourseGame('native-four-rounds-fixed', 0, 1))
  let checkedEmpty = false
  let checkedOwned = false
  for (let i = 0; i < 150; i++) {
    const game = controller.getSnapshot()
    const before = serializeLog(game)
    const arena = fromLocal(game)
    const details = arena.businessDetails!
    const canonical = businessOverview(game)
    assert.equal(details.purchaseCost, ECONOMY.business.cost)
    assert.equal(details.initialSaleValue, canonical.initialSale)
    assert.equal(details.currentSaleValue, canonical.sale)
    assert.equal(details.currentStartIncome, canonical.income)
    assert.equal(details.baseIncome, ECONOMY.business.baseIncome)
    assert.equal(details.matchingBonus, ECONOMY.business.matchingBonus)
    assert.equal(details.cashAfterPurchase, purchasePreview(game, ECONOMY.business.cost).cashAfter)
    assert.equal(details.owned, game.business.capital > 0)
    assert.deepEqual(details.currentCustomerPreference, currentCustomerPreference(game))
    assert.equal(serializeLog(game), before)
    if (game.phase === 'finished') break
    if (game.phase === 'event' && game.eventId === 'business' && !game.business.capital) {
      const buy = arena.fixed.find(item => item.command.type === 'trade' && item.command.action.kind === 'buy')
      if (buy) {
        checkedEmpty = true
        assert.equal(controller.dispatch(buy.command, game), true)
        checkedOwned = fromLocal(controller.getSnapshot()).businessDetails!.owned
        continue
      }
    }
    const command = game.phase === 'rolling' ? { type: 'roll' as const }
      : (arena.fixed.find(item => item.skip) ?? arena.fixed[0])?.command
        ?? setAmount(arena.trades[0], arena.trades[0].max)
    assert.equal(controller.dispatch(command, game), true)
  }
  assert.ok(checkedEmpty && checkedOwned, 'exercise the real business buy transition')
})
