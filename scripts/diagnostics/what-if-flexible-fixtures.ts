import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, transact } from '../../src/game/engine.ts'
import { creditBondLots } from '../../src/game/bond-credit.ts'
import { serializeLog } from '../../src/game/log.ts'
import { parseHistory } from '../../mobile_app/src/game/endgame-whatif-identity.ts'
import { WorkBudget } from '../../mobile_app/src/game/endgame-whatif-contract.ts'
import { applyRecorded, replayHistory } from '../../mobile_app/src/game/endgame-whatif-replay.ts'

/** Two distinct purchases, followed by a partial sale at START1. Native transitions only. */
export async function flexibleBondFixture(): Promise<{ text: string; sequence: number }> {
  const text = gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString()
  const work = new WorkBudget({ maxMilliseconds: 30_000 })
  const replay = await replayHistory(parseHistory(text), work, 13)
  if (!replay.before) throw new Error('flexible-fixture-prefix')
  let state = transact(replay.before, { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 2_000_000 })
  let sequence = 0
  function partialSale() {
    if (sequence || state.phase !== 'rebalancing' || state.lap !== 1) return
    if (creditBondLots(state).filter(item => item.quote.executable).length !== 2) throw new Error('flexible-fixture-lots')
    state = transact(state, { kind: 'sell', asset: 'bonds', amount: 1_000_000, lotId: 'bond-1' })
    sequence = state.log.at(-1)!.sequence
  }
  for (const command of replay.commands.filter(entry => entry.sequence > 13)) {
    partialSale()
    for (let steps = 0; state.phase !== command.before.phase || state.lap !== command.before.lap; steps++) {
      if (steps >= 6) throw new Error('flexible-fixture-alignment')
      state = advance(state)
      partialSale()
    }
    state = applyRecorded(state, command, work)
  }
  while (state.phase !== 'finished') state = advance(state)
  if (!sequence || state.termination !== 'completed') throw new Error('flexible-fixture-ending')
  return { text: serializeLog(state), sequence }
}
