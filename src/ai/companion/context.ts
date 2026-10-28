import { boardFor } from '../../data/board.ts'
import { canChoose } from '../../game/engine.ts'
import { goalForGame } from '../../game/rules-profile.ts'
import { saleQuote, totalWorth } from '../../game/selectors.ts'
import type { GameState } from '../../game/types.ts'
import { REPAIR_PROFILE, repairQuotes } from './repair-quotes.ts'
import { parseRepairContext } from './contracts.ts'
import { CompanionContractError } from './errors.ts'
import type { RepairContext } from './types.ts'

export interface ContextIdentity { sessionEpoch: string; revision: number }

/** Read-only projection. Never copies raw state/log/snapshot into the DTO. */
export function buildRepairContext(game: GameState, identity: ContextIdentity): RepairContext {
  const profile = REPAIR_PROFILE
  if (game.gameplayProfile !== profile.gameplayProfile || game.boardRevision !== profile.boardRevision
    || game.goalRulesVersion !== profile.goalRulesVersion || game.encounterRulesVersion !== profile.encounterRulesVersion
    || game.courseRulesVersion !== profile.courseRulesVersion || game.bondRulesVersion !== profile.bondRulesVersion
    || game.livingExpenseRulesVersion !== profile.livingExpenseRulesVersion || game.savingsProfile?.id !== profile.savingsProfileId
    || game.boardLayout !== 'B18' || game.gameMode !== 'experimental-b' || game.totalLaps !== 4
    || game.businessRulesVersion !== 'v2.4-customer-preferences' || game.market.catalogVersion !== 'vn-v1') {
    throw new CompanionContractError('UNSUPPORTED_PROFILE')
  }
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(identity.sessionEpoch) || !Number.isSafeInteger(identity.revision) || identity.revision < 0) {
    throw new CompanionContractError('INVALID_REQUEST')
  }
  const revealed = game.log.at(-1)
  if (game.phase !== 'event' || game.eventId !== 'repair' || game.pendingPayment || game.pendingCost
    || game.settlement || game.pendingLanding || game.termination || game.position !== 3
    || boardFor(game)[game.position].type !== 'personal'
    || !revealed || revealed.kind !== 'encounter' || revealed.eventId !== 'repair'
    || revealed.turn !== game.turn || revealed.lap !== game.lap || revealed.tileId !== game.position
    || !canChoose(game, 'full') || !canChoose(game, 'temporary')) {
    throw new CompanionContractError('DECISION_UNAVAILABLE')
  }
  return parseRepairContext({
    profile: { gameplayProfile: profile.gameplayProfile, boardRevision: profile.boardRevision,
      goalRulesVersion: profile.goalRulesVersion, encounterRulesVersion: profile.encounterRulesVersion,
      courseRulesVersion: profile.courseRulesVersion, bondRulesVersion: profile.bondRulesVersion,
      livingExpenseRulesVersion: profile.livingExpenseRulesVersion, savingsProfileId: profile.savingsProfileId,
      adviceRulesVersion: profile.adviceRulesVersion },
    decision: { decisionId: `${identity.sessionEpoch}:repair:${revealed.sequence}`,
      stateRevision: `${identity.sessionEpoch}:${identity.revision}`, phase: 'event', eventId: 'repair',
      encounterSequence: revealed.sequence, turn: game.turn, lap: game.lap, totalLaps: 4, tileIndex: 3, tileType: 'personal' },
    financial: { cashVnd: game.portfolio.cash,
      savingsPrincipalVnd: game.deposits.filter(lot => lot.status === 'active').reduce((sum, lot) => sum + lot.principal, 0),
      assetLiquidationQuoteVnd: saleQuote(game, 'stocks').net + saleQuote(game, 'bonds').net + saleQuote(game, 'gold').net,
      netWorthVnd: totalWorth(game), debtVnd: game.portfolio.debt, obligationsVnd: game.obligations,
      goalTargetVnd: goalForGame(game).target },
    options: repairQuotes(game.portfolio.cash, game.obligations, game.lap), revealedDecisions: [], publicMarket: [],
  })
}
