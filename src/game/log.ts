import type { GameState, Snapshot } from './types.ts'
import { boardFor } from '../data/board.ts'
import { ECONOMY, RULES } from '../data/config.ts'
import { liquidatableFunds, victory } from './selectors.ts'
import { savingsProfileForGame } from './savings.ts'

export function serializeLog(game: GameState): string {
  const actions = game.log.filter(entry=>entry.kind==='rebalancing')
  const count = (id: string) => actions.filter(entry=>entry.decisionId===id).length
  const funding = game.log.filter(entry=>entry.kind==='funding')
  const result = victory(game)
  const savingsProfile = savingsProfileForGame(game)
  // Upgrade missing V2.1 profile metadata without changing historical lot rates or amounts.
  const withProfile = (value: Snapshot): Snapshot => ({ ...value, savingsProfile: savingsProfileForGame(value) })
  const entries = game.log.map(entry => ({ ...entry, before: withProfile(entry.before), after: withProfile(entry.after) }))
  const settlement = game.settlement ? { ...game.settlement, before: withProfile(game.settlement.before) } : null
  return JSON.stringify({ schemaVersion: 5, seed: game.seed, rulesVersion: 'gameplay-v2.2-savings-2026-10-11', savingsProfile,
    mode:{id:game.gameMode,boardLayout:game.boardLayout,totalLaps:game.totalLaps},
    board:boardFor(game), financialConfig:{RULES,ECONOMY:{...ECONOMY,savingsRates:{...savingsProfile.rates}}},
    playtest:{diceRolls:game.log.filter(entry=>entry.kind==='roll').length,
      tileEncounters:game.log.filter(entry=>entry.kind==='encounter').map(entry=>({turn:entry.turn,lap:entry.lap,tile:entry.tileId+1,eventId:entry.eventId})),
      salaryPayments:game.log.filter(entry=>entry.title==='Nhận lương').length,
      businessPurchases:count('buy-business'),businessUpgrades:count('upgrade-business'),businessSales:count('sell-business'),
      lockedBusinessCapital:game.business.capital,lockedBusinessQuote:game.portfolio.business,
      courseInvestment:game.coursePurchased ? RULES.courseCost : 0,macroEvents:game.market.appliedShocks,
      savingsDeposits:game.deposits,savingsWithdrawals:funding.filter(entry=>entry.decisionId==='fund-savings').length,
      financialPurchases:Object.fromEntries(['stocks','bonds','gold'].map(asset=>[asset,count(`buy-${asset}`)+(asset==='stocks'?count('buy-stocks-complete'):0)])),
      financialSales:Object.fromEntries(['stocks','bonds','gold'].map(asset=>[asset,count(`sell-${asset}`)+funding.filter(entry=>entry.decisionId===`fund-${asset}`).length])),
      fundingDecisions:funding.length},
    finalResult:{status:game.phase!=='finished'?'in-progress':game.termination==='insolvent'?'insolvent':result.won?'victory':'defeat',
      won:game.phase==='finished'?result.won:null,lawfulProceeds:liquidatableFunds(game),termination:game.termination},
    finalPhase: game.phase, entries, summaries: game.summaries, state: {...game,savingsProfile,log:entries,settlement} }, null, 2)
}
