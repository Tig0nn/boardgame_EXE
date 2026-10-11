import type { GameState } from './types.ts'
import { boardFor } from '../data/board.ts'
import { ECONOMY, RULES } from '../data/config.ts'
import { liquidatableFunds, victory } from './selectors.ts'

export function serializeLog(game: GameState): string {
  const actions = game.log.filter(entry=>entry.kind==='rebalancing')
  const count = (id: string) => actions.filter(entry=>entry.decisionId===id).length
  const funding = game.log.filter(entry=>entry.kind==='funding')
  const result = victory(game)
  return JSON.stringify({ schemaVersion: 4, seed: game.seed, rulesVersion: 'gameplay-v2.1-playtest-2026-10-11',
    mode:{id:game.gameMode,boardLayout:game.boardLayout,totalLaps:game.totalLaps},
    board:boardFor(game), financialConfig:{RULES,ECONOMY},
    playtest:{diceRolls:game.log.filter(entry=>entry.kind==='roll').length,
      tileEncounters:game.log.filter(entry=>entry.kind==='encounter').map(entry=>({turn:entry.turn,lap:entry.lap,tile:entry.tileId+1,eventId:entry.eventId})),
      salaryPayments:game.log.filter(entry=>entry.title==='Nhận lương').length,
      businessPurchases:count('buy-business'),businessUpgrades:count('upgrade-business'),businessSales:count('sell-business'),
      lockedBusinessCapital:game.business.capital,lockedBusinessQuote:game.portfolio.business,
      courseInvestment:game.coursePurchased ? RULES.courseCost : 0,macroEvents:game.market.appliedShocks,
      savingsDeposits:game.deposits,savingsWithdrawals:funding.filter(entry=>entry.decisionId==='fund-savings').length,
      financialPurchases:Object.fromEntries(['stocks','bonds','gold'].map(asset=>[asset,count(`buy-${asset}`)])),
      financialSales:Object.fromEntries(['stocks','bonds','gold'].map(asset=>[asset,count(`sell-${asset}`)+funding.filter(entry=>entry.decisionId===`fund-${asset}`).length])),
      fundingDecisions:funding.length},
    finalResult:{status:game.phase!=='finished'?'in-progress':game.termination==='insolvent'?'insolvent':result.won?'victory':'defeat',
      won:game.phase==='finished'?result.won:null,lawfulProceeds:liquidatableFunds(game),termination:game.termination},
    finalPhase: game.phase, entries: game.log, summaries: game.summaries, state: game }, null, 2)
}
