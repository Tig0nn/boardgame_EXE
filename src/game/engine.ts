import { ECONOMY, MACRO_EVENTS, RULES, SCENARIOS } from '../data/config.ts'
import { boardFor } from '../data/board.ts'
import { gameMode } from '../data/modes.ts'
import { EVENTS } from '../data/events.ts'
import { hashSeed } from './random.ts'
import { copyState, draw, record, snapshot } from './state.ts'
import { collectPayment, fundSource, openDeposit, resolveInsolvency } from './transactions.ts'
import { applyMacroShock, initializeMarket } from './market.ts'
import { beginSettlement, continueSettlement } from './settlement.ts'
import { createSavingsProfile, savingsProfileForMode } from './savings.ts'
import { businessRulesForGame } from './business.ts'
import type { BusinessRulesVersion, FundingSource, GameModeId, GameState, Option, Term, SavingsProfileId } from './types.ts'
export { snapshot } from './state.ts'
export { netWorth, totalWorth, victory } from './selectors.ts'
export { rebalance, transact, withdrawSavings, fundingSources } from './transactions.ts'
function forecast(s: GameState): GameState {
  const next = { ...s, phase: 'forecast' as const }
  const weights = ECONOMY.business.trendWeights
  let pick = draw(next) * Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  next.scenarioId = SCENARIOS.at(-1)!.id
  for (const scenario of SCENARIOS) {
    pick -= weights[scenario.id as keyof typeof weights]
    if (pick < 0) { next.scenarioId = scenario.id; break }
  }
  return next
}
export function createGame(seed: string, savings: number, term: Term = 1, mode?: GameModeId, replayProfile?: SavingsProfileId, businessRulesVersion: BusinessRulesVersion = 'v2.3-fixed-income'): GameState {
  if (!Number.isFinite(savings) || !Number.isInteger(savings) || savings < 0 || savings > RULES.startingCapital) throw new Error('Phân bổ tiết kiệm không hợp lệ.')
  const selected = gameMode(mode ?? 'original')
  const state: GameState = {
    businessRulesVersion: businessRulesForGame({ businessRulesVersion }),
    savingsProfile: replayProfile ? createSavingsProfile(replayProfile) : savingsProfileForMode(selected.id),
    gameMode:selected.id, boardLayout:selected.boardLayout,
    // Legacy offline diagnostics can still scope RULES.laps before creating a game.
    // Browser setup always passes an explicit mode and never mutates shared config.
    totalLaps:mode ? selected.totalLaps : RULES.laps, businessPurchaseTurn:null,
    seed: seed.trim() || 'xoay-vong', rng: hashSeed(seed.trim() || 'xoay-vong'), lap: 1,
    position: 0, turn: 0, phase: 'forecast', scenarioId: '', dice: 0, eventId: null,
    savingsEligible: true, savingsMatured: false, recurringIncome: RULES.recurringIncome,
    unlockedAssets: [], pendingCost: 0, pendingPayment: null, settlement: null,
    obligations: 0, pendingLanding: false, summaries: [], log: [],
    deposits: [], market: initializeMarket(seed.trim() || 'xoay-vong'), stockHoldings: {}, goldUnits: 0, goldCostBasis: 0, bondLots: [],
    business: { capital: 0, recoverableCapital: 0, upgrades: {}, economicMultiplier: 1 },
    coursePurchased: false, borrowingLimit: RULES.borrowingLimit, termination: null,
    portfolio: { cash: RULES.startingCapital, savings: 0, stocks: 0, bonds: 0, gold: 0, business: 0, debt: 0 },
  }
  const initial = snapshot(state)
  if (![1, 2, 3].includes(term)) throw new Error('Kỳ hạn không hợp lệ.')
  if (savings > 0) openDeposit(state, savings, term)
  return record(forecast(state), initial, { kind: 'setup', title: 'Bắt đầu hành trình',
    decision: `Phân bổ ${savings} VND vào tiết kiệm`, consequence: '50.000.000 VND được phân bổ vào tiền mặt và tiết kiệm.' })
}
function encounter(s: GameState): GameState {
  const before = snapshot(s)
  let next = { ...s, phase: 'event' as const, pendingLanding: false }
  const tile = boardFor(s)[s.position].type
  if (tile === 'start') return { ...next, phase: 'rolling', eventId: null }
  const ids = tile === 'personal' ? ['medical', 'repair', 'family'] : tile === 'obligation' ? ['bills', 'contract', 'bonus']
    : tile === 'macro' ? MACRO_EVENTS.map(event => event.id) : [tile]
  const candidates = EVENTS.filter(e => ids.includes(e.id))
  next.eventId = candidates[Math.floor(draw(next) * candidates.length)].id
  if (['stocks', 'bonds', 'gold', 'business'].includes(tile)) next.unlockedAssets = [...new Set([...s.unlockedAssets, tile as 'stocks' | 'bonds' | 'gold' | 'business'])]
  next = record(next,before,{kind:'encounter',eventId:next.eventId!,title:`Dừng ô ${s.position+1}: ${boardFor(s)[s.position].label}`,
    decision:'Gặp ô trên bàn',consequence:`${s.boardLayout} · ${tile} · Kích hoạt sự kiện tại đích.`}) as typeof next
  if (tile === 'macro') next = applyMacroShock(next, next.eventId!) as typeof next
  return next
}
export function roll(state: GameState): GameState {
  if (state.phase !== 'rolling') return state
  const before = snapshot(state)
  let s = { ...state, portfolio: { ...state.portfolio }, turn: state.turn + 1 }
  s.dice = Math.floor(draw(s) * 6) + 1
  const board = boardFor(state)
  const crossed = state.position + s.dice >= board.length
  s.position = (state.position + s.dice) % board.length
  s.pendingLanding = crossed && s.position !== 0
  s = record(s, before, { kind: 'roll', title: `Xúc xắc: ${s.dice}`, decision: 'Gieo xúc xắc',
    consequence: crossed ? `Hoàn thành vòng ${s.lap}.` : `Di chuyển đến ô ${s.position + 1}: ${board[s.position].label}.` })
  return crossed ? beginSettlement(s) : encounter(s)
}
export function advance(state: GameState): GameState {
  if (state.phase === 'summary') {
    return { ...state, phase: 'rebalancing' }
  }
  if (state.phase === 'rebalancing') {
    if (state.lap === state.totalLaps) return { ...state, phase: 'finished', termination: 'completed', position: 0, pendingLanding: false }
    return forecast({ ...state, lap: state.lap + 1 })
  }
  if (state.phase === 'forecast') return state.pendingLanding ? encounter(state) : { ...state, phase: 'rolling' }
  return state
}
export function canChoose(state: GameState, optionId: string): boolean {
  const event = EVENTS.find(e => e.id === state.eventId)
  const option = event?.options.find(o => o.id === optionId)
  return state.phase === 'event' && !!option && !(event!.id === 'course' && option.id === 'upgrade' && (state.coursePurchased || state.portfolio.cash < RULES.courseCost))
}
function applyOption(s: GameState, option: Option): GameState {
  s.portfolio.cash += option.income ?? 0
  if (option.asset) {
    s.portfolio[option.asset] += option.amount ?? 0
    s.unlockedAssets = [...new Set([...s.unlockedAssets, option.asset])]
  }
  s.obligations += option.obligation ?? 0
  s.recurringIncome += option.recurringIncomeIncrease ?? 0
  if (option.recurringIncomeIncrease) s.coursePurchased = true
  s.eventId = null
  s.phase = 'rolling'
  return s
}
export function decide(state: GameState, optionId: string): GameState {
  if (state.phase !== 'event') return state
  const event = EVENTS.find(e => e.id === state.eventId)!
  const option = event.options.find(o => o.id === optionId)
  if (!option) throw new Error('Lựa chọn không hợp lệ.')
  if (!canChoose(state, optionId)) throw new Error('Không thể chọn: khóa học đã mua hoặc không đủ tiền mặt.')
  const before = snapshot(state)
  let s = copyState(state)
  const cashUsed = collectPayment(s, { origin: 'event', title: event.title,
    total: option.cost ?? 0, eventId: event.id, decisionId: option.id })
  if (!s.pendingPayment) s = applyOption(s, option)
  return resolveInsolvency(record(s, before, { kind: 'decision', eventId: event.id, decisionId: option.id, title: event.title,
    decision: option.label, expensePaid: cashUsed,
    consequence: s.pendingPayment ? `Đã dùng tiền mặt. Còn thiếu ${s.pendingPayment.remaining.toLocaleString('vi-VN')} ₫; bạn chọn nguồn thanh toán trước khi nhận quyền lợi.` : option.detail }))
}
export function fundPayment(state: GameState, source: FundingSource, amount: number, lotId?: string): GameState {
  let s = fundSource(state, source, amount, lotId)
  if (s.termination === 'insolvent') return s
  if (s.pendingPayment!.remaining > 0) return s
  const payment = s.pendingPayment!
  const before = snapshot(s)
  s = { ...s, pendingPayment: null, pendingCost: 0 }
  if (payment.origin === 'settlement') return continueSettlement(s)
  const event = EVENTS.find(e => e.id === payment.eventId)!
  const option = event.options.find(o => o.id === payment.decisionId)!
  s = applyOption(s, option)
  return record(s, before, { kind: 'event_resolution', title: event.title,
    eventId: event.id, decisionId: option.id, decision: 'Hoàn tất thanh toán', consequence: option.detail })
}
