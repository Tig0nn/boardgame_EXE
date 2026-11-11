import type {GameState,LogEntry} from '../../../src/game/types.ts'
import {canChoose,decide} from '../../../src/game/engine.ts'
import {boardFor} from '../../../src/data/board.ts'
import {applyRecorded} from './endgame-whatif-replay.ts'
import {sameExternal} from './endgame-whatif-fairness.ts'
import {equalData,commandIdentity} from './endgame-whatif-identity.ts'
import {requireEndgame} from './endgame-whatif-contract.ts'
import type {WorkBudget} from './endgame-whatif-contract.ts'
import type {GoldSelection} from './endgame-whatif-gold-contract.ts'
/** Internal native fork, never accepts a caller GameState in the public handle API. */
export function forkGold(before:GameState,entry:LogEntry,selection:GoldSelection,work:WorkBudget){
 requireEndgame(equalData(commandIdentity(entry),selection.decision)&&entry.kind==='rebalancing'&&entry.action?.kind==='buy'&&entry.action.asset==='gold'&&entry.action.completeEncounter===true
  &&entry.tileId===5&&before.position===5&&boardFor(before)[5].type==='gold'&&before.phase==='event'&&before.eventId==='gold'
  &&before.turn===entry.turn&&before.lap===entry.lap&&before.log.length+1===entry.sequence
  &&before.goldUnits===0&&before.portfolio.gold===0&&!before.pendingPayment&&!before.settlement&&!before.termination&&canChoose(before,'skip'),'gold-fork-not-legal')
 const actual=applyRecorded(structuredClone(before),entry,work);work.step();const alternative=decide(structuredClone(before),'skip')
 requireEndgame(actual.log.length===before.log.length+1&&alternative.log.length===before.log.length+1&&alternative.goldUnits===before.goldUnits&&alternative.portfolio.gold===before.portfolio.gold,'gold-fork-progress')
 requireEndgame(sameExternal(actual,alternative),'gold-fork-external-mismatch')
 return{actual,alternative}
}
