import type { DecisionParameters, WhatIfDecision } from './orchestrator.ts'
import { parameterAlternativeId, parameterQuestion } from './orchestrator.ts'
import type { HistoricalDecision } from './flexible-catalog.ts'

/** Untrusted language extraction. It is never an executable proposal or an engine command. */
export type NaturalIntent = {
  kind: WhatIfDecision['kind']; action: 'skip' | 'buy' | 'sell' | 'deposit' | 'basic' | 'advanced' | 'upgrade'
  sequence?: number; lap?: number; turn?: number; occurrence?: 'first' | 'last'
  amount?: number; symbolId?: string; issuerId?: 'an-tam' | 'but-pha'; lotId?: string; term?: 1 | 2 | 3
  preferenceId?: 'budget' | 'taste' | 'checkin'; originalAction?: 'buy' | 'sell' | 'deposit' | 'upgrade' | 'basic' | 'advanced'
  originalSymbolId?: string; originalIssuerId?: 'an-tam' | 'but-pha'; originalLotId?: string
}
export type IntentReply = { status: 'intent'; intent: NaturalIntent } | { status: 'ambiguous' | 'unsupported' | 'multiple-changes' }
export type HistoryLocator = Pick<NaturalIntent, 'sequence' | 'lap' | 'turn' | 'occurrence' | 'originalAction' | 'originalSymbolId' | 'originalIssuerId' | 'originalLotId'>
export function historyLocator(intent: NaturalIntent): HistoryLocator {
  return Object.fromEntries(['sequence', 'lap', 'turn', 'occurrence', 'originalAction', 'originalSymbolId', 'originalIssuerId', 'originalLotId'].filter(key => Object.hasOwn(intent, key))
    .map(key => [key, intent[key as keyof NaturalIntent]]))
}
const actions: Record<NaturalIntent['kind'], string[]> = { gold: ['skip'], stocks: ['buy', 'sell', 'skip'],
  bonds: ['buy', 'sell', 'skip'], bank: ['deposit', 'skip'], business: ['buy', 'sell', 'upgrade', 'skip'],
  course: ['basic', 'advanced', 'skip'], advanced: ['basic', 'advanced', 'skip'] }
const common = ['kind', 'action', 'sequence', 'lap', 'turn', 'occurrence', 'originalAction']
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && 'value' in Object.getOwnPropertyDescriptor(value, key)!)
}
export function readIntentReply(value: unknown): IntentReply | null {
  if (!plain(value)) return null
  if (value.status === 'ambiguous' || value.status === 'unsupported' || value.status === 'multiple-changes') {
    return Object.keys(value).length === 1 ? value as IntentReply : null
  }
  if (value.status !== 'intent' || Object.keys(value).length !== 2 || !plain(value.intent)) return null
  const intent = value.intent, kind = intent.kind
  if (typeof kind !== 'string' || typeof intent.action !== 'string' || !Object.hasOwn(actions, kind) || !actions[kind as NaturalIntent['kind']].includes(intent.action)) return null
  const allowed = [...common, ...(kind === 'stocks' ? ['amount', 'symbolId'] : kind === 'bonds' ? ['amount', 'issuerId', 'lotId']
    : kind === 'bank' ? ['amount', 'term'] : kind === 'business' ? ['preferenceId'] : []),
  ...(intent.action === 'skip' ? kind === 'stocks' ? ['originalSymbolId'] : kind === 'bonds' ? ['originalIssuerId', 'originalLotId'] : [] : [])]
  if (Object.keys(intent).some(key => !allowed.includes(key))) return null
  for (const [key, max] of [['sequence', 500], ['lap', 4], ['turn', 200], ['amount', Number.MAX_SAFE_INTEGER]] as const) {
    if (Object.hasOwn(intent, key) && (!Number.isSafeInteger(intent[key]) || Number(intent[key]) <= 0 || Number(intent[key]) > max)) return null
  }
  if (Object.hasOwn(intent, 'occurrence') && (typeof intent.occurrence !== 'string' || !['first', 'last'].includes(intent.occurrence))
    || Object.hasOwn(intent, 'term') && (typeof intent.term !== 'number' || ![1, 2, 3].includes(intent.term))
    || Object.hasOwn(intent, 'symbolId') && (typeof intent.symbolId !== 'string' || !/^[A-Z0-9-]{1,16}$/.test(intent.symbolId))
    || Object.hasOwn(intent, 'lotId') && (typeof intent.lotId !== 'string' || !/^bond-[1-9][0-9]{0,2}$/.test(intent.lotId))
    || Object.hasOwn(intent, 'issuerId') && (typeof intent.issuerId !== 'string' || !['an-tam', 'but-pha'].includes(intent.issuerId))
    || Object.hasOwn(intent, 'preferenceId') && (typeof intent.preferenceId !== 'string' || !['budget', 'taste', 'checkin'].includes(intent.preferenceId))
    || Object.hasOwn(intent, 'originalAction') && (typeof intent.originalAction !== 'string' || !['buy', 'sell', 'deposit', 'upgrade', 'basic', 'advanced'].includes(intent.originalAction))) return null
  if (intent.action === 'skip' && ['amount', 'symbolId', 'issuerId', 'lotId', 'term', 'preferenceId'].some(key => Object.hasOwn(intent, key))) return null
  if (kind === 'bonds' && (intent.action === 'buy' && Object.hasOwn(intent, 'lotId') || intent.action === 'sell' && Object.hasOwn(intent, 'issuerId'))) return null
  if (Object.hasOwn(intent, 'originalSymbolId') && (typeof intent.originalSymbolId !== 'string' || !/^[A-Z0-9-]{1,16}$/.test(intent.originalSymbolId))
    || Object.hasOwn(intent, 'originalLotId') && (typeof intent.originalLotId !== 'string' || !/^bond-[1-9][0-9]{0,2}$/.test(intent.originalLotId))
    || Object.hasOwn(intent, 'originalIssuerId') && (typeof intent.originalIssuerId !== 'string' || !['an-tam', 'but-pha'].includes(intent.originalIssuerId))) return null
  return structuredClone(value) as IntentReply
}

export function requiredParameters(intent: NaturalIntent): string[] {
  if (intent.action === 'skip') return []
  const keys = intent.kind === 'stocks' ? ['symbolId', 'amount'] : intent.kind === 'bonds'
    ? [intent.action === 'buy' ? 'issuerId' : 'lotId', 'amount'] : intent.kind === 'bank' ? ['amount', 'term']
      : intent.action === 'upgrade' ? ['preferenceId'] : []
  return keys.filter(key => !Object.hasOwn(intent, key))
}
export function intentParameters(intent: NaturalIntent): DecisionParameters | undefined {
  if (requiredParameters(intent).length || !['stocks', 'bonds', 'bank'].includes(intent.kind) || intent.action === 'skip') return undefined
  const parameters = { operation: intent.action, amount: intent.amount,
    ...Object.fromEntries(['symbolId', 'issuerId', 'lotId', 'term'].filter(key => Object.hasOwn(intent, key)).map(key => [key, intent[key as keyof NaturalIntent]])) }
  return parameterAlternativeId(intent.kind, parameters) ? parameters as DecisionParameters : undefined
}
export function intentAlternativeId(intent: NaturalIntent): WhatIfDecision['alternativeId'] | null {
  const parameters = intentParameters(intent)
  if (parameters) return parameterAlternativeId(intent.kind, parameters)
  if (intent.action === 'skip') return 'skip'
  if (intent.action === 'basic' || intent.action === 'advanced') return `course-${intent.action}`
  if (intent.kind === 'business') return intent.action === 'upgrade' && intent.preferenceId ? `upgrade-business:${intent.preferenceId}`
    : intent.action === 'buy' ? 'buy-business' : intent.action === 'sell' ? 'sell-business' : null
  return null
}
export function decisionQuestion(choice: WhatIfDecision): string {
  if (choice.parameters) return parameterQuestion(choice)
  const alternative = choice.alternativeId
  const omissions: Record<WhatIfDecision['kind'], string> = {
    gold: 'Bỏ mua vàng', stocks: 'Bỏ qua giao dịch cổ phiếu', bonds: 'Bỏ qua giao dịch trái phiếu',
    bank: 'Bỏ gửi tiết kiệm', business: 'Bỏ qua quyết định kinh doanh', course: 'Bỏ qua lần học', advanced: 'Bỏ qua lần học',
  }
  const question = alternative === 'course-basic' ? 'Học khóa cơ bản' : alternative === 'course-advanced' ? 'Học khóa nâng cao'
    : alternative.startsWith('upgrade-business:') ? `Nâng cấp ${alternative.endsWith('budget') ? 'giá cả hợp lý' : alternative.endsWith('taste') ? 'chất lượng đồ uống' : 'không gian check-in'}`
      : alternative === 'buy-business' ? 'Mua cơ sở' : alternative === 'sell-business' ? 'Bán cơ sở' : omissions[choice.kind]
  return `${question} tại quyết định ${choice.decisionId.split(':')[1]}`
}
export function matchingHistory(intent: HistoryLocator, history: HistoricalDecision[]) {
  const rows = history.filter(row => (!intent.sequence || intent.sequence === row.sequence) && (!intent.lap || intent.lap === row.lap)
    && (!intent.originalSymbolId || intent.originalSymbolId === row.symbolId) && (!intent.originalIssuerId || intent.originalIssuerId === row.issuerId)
    && (!intent.originalLotId || intent.originalLotId === row.lotId)
    && (!intent.turn || intent.turn === row.turn) && (!intent.originalAction || (intent.originalAction === 'basic' || intent.originalAction === 'advanced'
      ? row.action === `course-${intent.originalAction}` : row.action.startsWith(intent.originalAction))))
  return intent.occurrence && rows.length ? [intent.occurrence === 'first' ? rows[0] : rows.at(-1)!] : rows
}
const normalized = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ', 'd')
export function readVndAmount(value: string): number | undefined {
  const text = value.trim()
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(text)) return undefined
  const amount = Number(text.replace(/[.,]/g, ''))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined
}
function monetary(text: string): number | undefined {
  if (/[-−]\s*\d/.test(text.replace(/bond-\d+/g, ''))) return undefined
  const cleaned = text.replace(/(?:quyet dinh|vong|luot|ky han)\s*\d+(?:\s*start)?|\d+\s*start|bond-\d+|lot\s*\d+/g, '')
  const numbers = [...cleaned.matchAll(/\b([0-9]+(?:[.,][0-9]+)*)\s*(trieu|tr|nghin|ngan|k|ty|vnd|dong)?\b/g)]
  if (numbers.length !== 1) return undefined
  const [, raw, unit] = numbers[0]
  const scale = unit === 'ty' ? 1_000_000_000 : unit === 'trieu' || unit === 'tr' ? 1_000_000 : ['nghin', 'ngan', 'k'].includes(unit) ? 1000 : 1
  if (scale === 1) return readVndAmount(raw)
  if (/[.,]\d{3}$/.test(raw)) return undefined
  const amount = Number(raw.replace(',', '.')) * scale
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined
}
function bankTerm(text: string): number | undefined {
  const terms = [...text.matchAll(/ky han\s*(\d+(?:[.,]\d+)?)(?:\s*(ngay|thang|nam)\b)?|\b(\d+(?:[.,]\d+)?)\s*start\b/g)]
  if (terms.length !== 1 || terms[0][2]) return undefined
  const raw = terms[0][1] ?? terms[0][3]
  return /^\d+$/.test(raw) ? Number(raw) : undefined
}
export function hasExplicitFinancialParameters(question: string, intent: NaturalIntent): boolean {
  const text = normalized(question)
  return (intent.amount === undefined || monetary(text) === intent.amount)
    && (intent.term === undefined || bankTerm(text) === intent.term)
}
/** Labelled mock grammar for DEV. No amounts, targets, or historical choices are inferred from outcomes. */
export function interpretMock(question: string): IntentReply {
  const text = normalized(question).replace(/\s+/g, ' ')
  if (/[-−]\s*\d/.test(text.replace(/bond-\d+/g, ''))) return { status: 'unsupported' }
  if (/\b(?:hoac|hay)\b/.test(text)) return { status: 'ambiguous' }
  if (/ky han\s*\d+\s*(?:ngay|thang|nam)\b/.test(text)) return { status: 'unsupported' }
  const symbols = [...text.matchAll(/\b(fpt|cmg|vcb|tcb|hpg|bmp)\b/g)].map(match => match[1].toUpperCase())
  const symbol = symbols[0] ?? /\bma\s+([a-z0-9-]{2,16})\b/.exec(text)?.[1]?.toUpperCase()
    ?? /(?:cổ phiếu|co phieu)\s+([A-Z][A-Z0-9-]{1,15})(?=\s|[?.!,]|$)/u.exec(question)?.[1]
  const verbs = text.replace(/\b(?:khoa hoc|co ban)\b/g, '').match(/\b(?:mua|ban|gui|hoc|nang cap)\b/g) ?? []
  if (/(?:va|dong thoi|roi|sau do)\s+(?:(?:toi|cung)\s+)?(?:mua|ban|gui|bo|khong|hoc|nang cap)/.test(text)
    || verbs.length > 1 || new Set(symbols).size > 1) return { status: 'multiple-changes' }
  const kinds: NaturalIntent['kind'][] = []
  if (/co phieu/.test(text) || symbols.length) kinds.push('stocks')
  if (/trai phieu|an tam|but pha|bond-/.test(text)) kinds.push('bonds')
  if (/tiet kiem|ngan hang|gui tien|\bgui\b/.test(text)) kinds.push('bank')
  if (/vang/.test(text)) kinds.push('gold')
  if (/\bkhoa\b|\bcourse\b|\bhoc\b/.test(text)) kinds.push('course')
  if (/co so|kinh doanh|nang cap|\bquan\b/.test(text)) kinds.push('business')
  if (kinds.length > 1) return { status: 'multiple-changes' }
  if (!kinds.length) return { status: 'ambiguous' }
  const kind = kinds[0], skip = /\bbo(?: qua)?\b|\bkhong (?:(?:can|muon|nen) )?(?:mua|ban|gui|hoc|nang cap)|\bdung (?:mua|ban|gui|hoc|nang cap)/.test(text)
  if (/\bkhong\b/.test(text.replace(/\bkhong gian\b/g, '')) && !skip) return { status: 'ambiguous' }
  const action: NaturalIntent['action'] | undefined = skip ? 'skip' : kind === 'bank' && /gui/.test(text) ? 'deposit'
    : /nang cap/.test(text) ? 'upgrade' : kind === 'course' ? /nang cao|\badvanced\b/.test(text) ? 'advanced' : /co ban|\bbasic\b/.test(text) ? 'basic' : undefined
      : /\bmua\b/.test(text) ? 'buy' : /\bban\b/.test(text) ? 'sell' : undefined
  if (!action || !actions[kind].includes(action) || kind === 'gold' && !/(?:bo(?: qua)?|khong) mua vang/.test(text)) return { status: 'unsupported' }
  const intent: NaturalIntent = { kind, action }
  for (const [key, pattern] of [['sequence', /quyet dinh\s*(\d+)/], ['lap', /vong\s*(\d+)/], ['turn', /luot\s*(\d+)/]] as const) {
    const match = pattern.exec(text)
    if (match) intent[key] = Number(match[1])
  }
  if (/lan dau|dau tien/.test(text)) intent.occurrence = 'first'
  if (/lan cuoi|cuoi cung/.test(text)) intent.occurrence = 'last'
  if (skip) {
    intent.originalAction = kind === 'course' ? /nang cao|\badvanced\b/.test(text) ? 'advanced' : /co ban|\bbasic\b/.test(text) ? 'basic' : undefined
      : /\bmua\b/.test(text) ? 'buy' : /\bban\b/.test(text) ? 'sell' : /gui/.test(text) ? 'deposit' : /nang cap/.test(text) ? 'upgrade' : undefined
    if (!intent.originalAction) delete intent.originalAction
    if (kind === 'stocks' && symbol) intent.originalSymbolId = symbol
    if (kind === 'bonds' && /an tam|but pha/.test(text)) intent.originalIssuerId = /an tam/.test(text) ? 'an-tam' : 'but-pha'
    const lot = /bond-(\d+)|lot\s*(\d+)/.exec(text)
    if (kind === 'bonds' && lot) intent.originalLotId = `bond-${lot[1] ?? lot[2]}`
  } else {
    const amount = monetary(text)
    if (['stocks', 'bonds', 'bank'].includes(kind) && amount) intent.amount = amount
    if (kind === 'stocks' && symbol) intent.symbolId = symbol
    if (kind === 'bonds') {
      if (action === 'buy' && /an tam|but pha/.test(text)) intent.issuerId = /an tam/.test(text) ? 'an-tam' : 'but-pha'
      const lot = /bond-(\d+)|lot\s*(\d+)/.exec(text)
      if (action === 'sell' && lot) intent.lotId = `bond-${lot[1] ?? lot[2]}`
    }
    const term = bankTerm(text)
    if (kind === 'bank' && term !== undefined) intent.term = term as 1 | 2 | 3
    if (kind === 'business' && action === 'upgrade') {
      if (/gia ca|budget/.test(text)) intent.preferenceId = 'budget'
      else if (/do uong|taste/.test(text)) intent.preferenceId = 'taste'
      else if (/check.in|khong gian/.test(text)) intent.preferenceId = 'checkin'
    }
  }
  return readIntentReply({ status: 'intent', intent }) ?? { status: 'unsupported' }
}
