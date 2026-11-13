import { intentAlternativeId, intentParameters, matchingHistory, requiredParameters } from '../../../../src/ai/what-if/natural-language.ts'
import type { HistoricalDecision, NaturalIntent } from '../../../../src/ai/what-if/natural-language.ts'
import type { WhatIfDecision } from '../../../../src/ai/what-if/orchestrator.ts'
import { money } from '../../../../src/game/format.ts'
import { publicBusinessState } from './b18-business.ts'
import { ApiError } from '../errors.ts'
import { whatIfBody } from '../validation.ts'
import type { WhatIfRequest } from '../validation.ts'
import { applyWhatIfAlternative } from './what-if-replay.ts'
import type { HistoricalStep } from './what-if-replay.ts'

export function recordedKind(step: HistoricalStep): WhatIfDecision['kind'] | undefined {
  const action = step.action
  if (action.actionId === 'trade') {
    if ('asset' in action.payload) return action.payload.asset
    if (action.payload.kind === 'deposit' || action.payload.kind === 'repay') return 'bank'
  }
  if (action.actionId === 'choose') {
    const event = step.before.eventId
    if (event === 'course' || event === 'bank' || event === 'gold' || event === 'stocks' || event === 'bonds' || event === 'business') return event
  }
}

function historyRow(step: HistoricalStep): HistoricalDecision {
  const action = step.action
  const payload = action.actionId === 'trade' ? action.payload : null
  return {
    sequence: action.expectedStateVersion + 1, lap: step.before.lap, turn: step.before.turn,
    action: payload?.kind ?? (action.actionId === 'choose' ? action.payload.optionId : action.actionId),
    symbolId: payload && 'symbolId' in payload ? payload.symbolId : undefined,
    issuerId: payload && 'issuerId' in payload ? payload.issuerId : undefined,
    lotId: payload && 'lotId' in payload ? payload.lotId : undefined,
  }
}

function alternativeFor(step: HistoricalStep, intent: NaturalIntent) {
  const { action, kind } = intent
  if (action === 'skip') {
    if (step.action.actionId === 'trade') return { mode: 'omit' }
    if (kind === 'course' || kind === 'advanced') return { mode: 'replace', action: { actionId: 'choose', payload: { optionId: 'skip' } } }
    return
  }
  if (action === 'basic' || action === 'advanced') return {
    mode: 'replace', action: { actionId: 'choose', payload: { optionId: 'course-' + action } },
  }
  let payload
  if (kind === 'business') {
    const candidate = publicBusinessState(step.before, true).actions.find(item => item.kind === action)
    if (candidate) payload = action === 'upgrade' ? { ...candidate, customerPreferenceId: intent.preferenceId } : candidate
  } else if (kind === 'bank') payload = { kind: 'deposit', amount: intent.amount, term: intent.term }
  else if (kind === 'stocks') payload = { kind: action, asset: kind, amount: intent.amount, symbolId: intent.symbolId }
  else if (kind === 'bonds') payload = action === 'buy'
    ? { kind: action, asset: kind, amount: intent.amount, issuerId: intent.issuerId }
    : { kind: action, asset: kind, amount: intent.amount, lotId: intent.lotId }
  return payload && { mode: 'replace', action: { actionId: 'trade', payload } }
}

export function buildProposalCandidates(steps: HistoricalStep[], stateVersion: number, intent: NaturalIntent) {
  const missing = requiredParameters(intent)
  if (missing.length) return { status: 'needs-details' as const, missing }
  const alternativeId = intentAlternativeId(intent)
  const parameters = intentParameters(intent)
  const originalKind = intent.kind === 'advanced' ? 'course' : intent.kind
  if (!alternativeId) return { status: 'unsupported' as const }
  const history = steps.filter(step => recordedKind(step) === originalKind).map(historyRow)
  const rows = matchingHistory(intent, history)
  if (rows.length > 16) return { status: 'ambiguous' as const }

  const candidates: { choice: WhatIfDecision; request: WhatIfRequest; original: string; replacement: string }[] = []
  for (const { sequence, lap, turn } of rows) {
    const step = steps[sequence - 1]
    const parsed = whatIfBody.safeParse({ stateVersion, sequence, alternative: alternativeFor(step, intent) })
    if (!parsed.success) continue
    let forkAfter
    try {
      forkAfter = applyWhatIfAlternative(step, parsed.data.alternative)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'WHAT_IF_ILLEGAL_ALTERNATIVE') continue
      throw error
    }
    candidates.push({
      choice: { kind: intent.kind, decisionId: intent.kind + ':' + sequence, alternativeId, lap, turn, ...(parameters ? { parameters } : {}) },
      request: parsed.data,
      original: step.after.log[step.before.log.length]?.decision ?? 'Quyết định đã lưu',
      replacement: proposalLabel(parsed.data.alternative, forkAfter.log[step.before.log.length]?.decision),
    })
  }
  if (!candidates.length) return { status: 'unsupported' as const }
  // Only suggest a target the player's explicit locators and the canonical probes identify uniquely.
  if (candidates.length !== 1) return { status: 'ambiguous' as const }
  return { status: 'ready' as const, candidates }
}

function proposalLabel(alternative: WhatIfRequest['alternative'], decision?: string) {
  if (alternative.mode === 'omit') return 'Bỏ giao dịch đã ghi nhận'
  const { action } = alternative
  if (action.actionId !== 'trade') return decision ?? 'Thay lựa chọn tại sự kiện'
  const payload = action.payload
  const target = 'symbolId' in payload ? payload.symbolId : 'issuerId' in payload ? payload.issuerId
    : 'lotId' in payload ? payload.lotId : 'customerPreferenceId' in payload ? payload.customerPreferenceId : undefined
  const term = payload.kind === 'deposit' && payload.term ? ' · Kỳ hạn ' + payload.term + ' START' : ''
  return (decision ?? 'Thay giao dịch') + (target ? ' · ' + target : '') + ' · ' + money(payload.amount) + term
}
