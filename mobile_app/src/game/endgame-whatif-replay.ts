import { advance, canChoose, decide, roll, transact, fundPayment } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { snapshot } from '../../../src/game/state.ts'
import { serializeLog } from '../../../src/game/log.ts'
import type { GameState, LogEntry, FundingSource, Term } from '../../../src/game/types.ts'
import { requireEndgame } from './endgame-whatif-contract.ts'
import type { Source, WorkBudget } from './endgame-whatif-contract.ts'
import { equalData, metadataKeys } from './endgame-whatif-identity.ts'

export const isCommand = (entry: LogEntry) => ['roll', 'decision', 'rebalancing', 'funding'].includes(entry.kind)
export const commandsOf = (source: Source) => source.entries.filter(isCommand)
export function advanceOnce(state: GameState, work: WorkBudget) {
  work.step()
  const next = advance(state)
  requireEndgame(next !== state, 'engine-no-progress')
  return next
}
export function alignActual(state: GameState, entry: LogEntry, work: WorkBudget) {
  let s = state
  for (let i = 0; i < 4 && (s.phase !== entry.before.phase || s.lap !== entry.before.lap); i++) s = advanceOnce(s, work)
  requireEndgame(s.phase === entry.before.phase && s.lap === entry.before.lap, 'phase-unreachable')
  requireEndgame(equalData(snapshot(s), entry.before), 'actual-snapshot-mismatch')
  return s
}
/** Executes exact recorded parameters; never infer skip or resize a later action. */
export function applyRecorded(s: GameState, entry: LogEntry, work: WorkBudget) {
  work.step()
  let next: GameState
  if (entry.kind === 'roll') {
    requireEndgame(s.phase === 'rolling', 'command-context')
    next = roll(s)
  } else if (entry.kind === 'decision') {
    requireEndgame(s.phase === 'event' && s.eventId === entry.eventId && entry.decisionId && canChoose(s, entry.decisionId), 'illegal-decision')
    next = decide(s, entry.decisionId)
  } else if (entry.kind === 'rebalancing') {
    requireEndgame(entry.action, 'missing-action')
    next = transact(s, entry.action)
  } else {
    requireEndgame(entry.kind === 'funding' && entry.decisionId?.startsWith('fund-'), 'funding-invalid')
    const source = entry.decisionId!.slice(5) as FundingSource
    requireEndgame(['debt', 'savings', 'stocks', 'bonds', 'gold'].includes(source), 'funding-invalid')
    const lot = entry.before.deposits.find(item => item.status === 'active'
      && entry.after.deposits.find(after => after.id === item.id)?.status === 'withdrawn')
    const amount = source === 'debt' ? entry.after.portfolio.debt - entry.before.portfolio.debt
      : source === 'savings' ? lot?.principal : entry.forcedAssetSaleAmount
    requireEndgame(Number.isSafeInteger(amount) && amount! > 0, 'funding-invalid')
    next = fundPayment(s, source, amount!, source === 'bonds' ? entry.fundingLotId : lot?.id)
  }
  requireEndgame(next !== s && next.log.length > s.log.length, 'engine-no-progress')
  return next
}
/** Full browser-safe genesis reconstruction, not a cast of an entry Snapshot. */
export async function replayHistory(source: Source, work: WorkBudget, selected?: number) {
  const initial = source.entries[0].after, lot = initial.deposits[0]
  const term = (lot ? lot.maturityLap - lot.startLap + 1 : 1) as Term
  let s = createMultiCourseGame(source.seed, initial.portfolio.savings, term)
  const setup = JSON.parse(serializeLog(s)) as Source
  requireEndgame(metadataKeys.every(key => equalData(source[key], setup[key])), 'engine-config-mismatch')
  requireEndgame(equalData(s.log, source.entries.slice(0, s.log.length)), 'setup-mismatch')
  let before: GameState | undefined
  const commands = commandsOf(source)
  for (let i = 0; i < commands.length; i++) {
    const entry = commands[i]
    s = alignActual(s, entry, work)
    if (entry.sequence === selected) before = structuredClone(s)
    const count = s.log.length
    s = applyRecorded(s, entry, work)
    requireEndgame(equalData(s.log.slice(count), source.entries.slice(count, s.log.length)), 'actual-prefix-mismatch')
    if (i % 8 === 0) await work.yield()
  }
  for (let i = 0; i < 4 && (s.phase !== source.state.phase || s.lap !== source.state.lap); i++) s = advanceOnce(s, work)
  requireEndgame(equalData(s, source.state), 'actual-final-mismatch')
  requireEndgame(source.state.phase === 'finished', 'source-not-terminal')
  return { final: s, before, commands }
}
