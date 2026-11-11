import type {GameState} from '../../../src/game/types.ts'
import {endingMetrics,comparableEndings,signedMetrics,endingFacts} from './endgame-whatif-comparison.ts'
import type {GoldMetrics,GoldLedgerEntry} from './endgame-whatif-gold-contract.ts'
export const goldMetrics=(s:GameState):GoldMetrics=>({...endingMetrics(s),gold:{units:s.goldUnits,book:s.portfolio.gold,basis:s.goldCostBasis}})
export const goldCosts=(ledger:GoldLedgerEntry[])=>ledger.flatMap(row=>row.saleCosts?[{sourceSequence:row.sourceCommand.sequence,...row.saleCosts}]:[])
export {comparableEndings,signedMetrics,endingFacts}
