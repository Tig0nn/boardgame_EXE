import type { DecisionParameters, WhatIfDecision } from './orchestrator.ts'
import { parameterAlternativeId, parameterQuestion } from './orchestrator.ts'
export type HistoricalDecision = { sequence: number; lap: number; turn: number; action: string; description?: string;
  symbolId?: string; issuerId?: string; lotId?: string }

/** Untrusted language extraction. It is never an executable proposal or an engine command. */
export type NaturalIntent = {
  kind: WhatIfDecision['kind']; action: 'skip' | 'buy' | 'sell' | 'deposit' | 'basic' | 'advanced' | 'upgrade'
  sequence?: number; lap?: number; turn?: number; occurrence?: 'first' | 'last'
  amount?: number; symbolId?: string; issuerId?: 'an-tam' | 'but-pha'; lotId?: string; term?: 1 | 2 | 3
  preferenceId?: 'budget' | 'taste' | 'checkin'; originalAction?: 'buy' | 'sell' | 'deposit' | 'upgrade' | 'basic' | 'advanced'
  originalSymbolId?: string; originalIssuerId?: 'an-tam' | 'but-pha'; originalLotId?: string
}
export type IntentReply = { status: 'intent'; intent: NaturalIntent } | { status: (typeof INTENT_REFUSAL_STATUSES)[number] }
export type HistoryLocator = Pick<NaturalIntent, 'sequence' | 'lap' | 'turn' | 'occurrence' | 'originalAction' | 'originalSymbolId' | 'originalIssuerId' | 'originalLotId'>
export function historyLocator(intent: NaturalIntent): HistoryLocator {
  return Object.fromEntries(['sequence', 'lap', 'turn', 'occurrence', 'originalAction', 'originalSymbolId', 'originalIssuerId', 'originalLotId'].filter(key => Object.hasOwn(intent, key))
    .map(key => [key, intent[key as keyof NaturalIntent]]))
}
export const INTENT_REFUSAL_STATUSES = ['ambiguous', 'unsupported', 'multiple-changes'] as const

export const INTENT_COMMON_FIELDS = ['sequence', 'lap', 'turn', 'occurrence', 'originalAction'] as const

export const INTENT_FIELD_RULES = {
  sequence: { type: 'integer', minimum: 1, maximum: 500, description: 'Recorded decision number in quyết định N.' },
  lap: { type: 'integer', minimum: 1, maximum: 4, description: 'Lap number in vòng N.' },
  turn: { type: 'integer', minimum: 1, maximum: 200, description: 'Turn number in lượt N.' },
  amount: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: 'Explicit VND amount; 1.234.567 VND means 1234567.' },
  term: { type: 'integer', minimum: 1, maximum: 3, description: 'Explicit bank term in START periods.' },
  occurrence: { type: 'string', enum: ['first', 'last'] },
  symbolId: { type: 'string', pattern: /^[A-Z0-9-]{1,16}$/ },
  issuerId: { type: 'string', enum: ['an-tam', 'but-pha'] },
  lotId: { type: 'string', pattern: /^bond-[1-9][0-9]{0,2}$/ },
  preferenceId: { type: 'string', enum: ['budget', 'taste', 'checkin'] },
  originalAction: { type: 'string', enum: ['buy', 'sell', 'deposit', 'upgrade', 'basic', 'advanced'] },
  originalSymbolId: { type: 'string', pattern: /^[A-Z0-9-]{1,16}$/ },
  originalIssuerId: { type: 'string', enum: ['an-tam', 'but-pha'] },
  originalLotId: { type: 'string', pattern: /^bond-[1-9][0-9]{0,2}$/ },
} as const

type IntentVariant = { actions: readonly NaturalIntent['action'][]; fields: readonly (keyof typeof INTENT_FIELD_RULES)[] }
export const INTENT_VARIANTS: Readonly<Record<NaturalIntent['kind'], readonly IntentVariant[]>> = {
  gold: [{ actions: ['skip'], fields: [] }],
  stocks: [{ actions: ['buy', 'sell'], fields: ['amount', 'symbolId'] }, { actions: ['skip'], fields: ['originalSymbolId'] }],
  bonds: [{ actions: ['buy'], fields: ['amount', 'issuerId'] }, { actions: ['sell'], fields: ['amount', 'lotId'] },
    { actions: ['skip'], fields: ['originalIssuerId', 'originalLotId'] }],
  bank: [{ actions: ['deposit'], fields: ['amount', 'term'] }, { actions: ['skip'], fields: [] }],
  business: [{ actions: ['buy', 'sell', 'upgrade'], fields: ['preferenceId'] }, { actions: ['skip'], fields: [] }],
  course: [{ actions: ['basic', 'advanced', 'skip'], fields: [] }],
  advanced: [{ actions: ['basic', 'advanced', 'skip'], fields: [] }],
}

function allowsAction(variant: IntentVariant, action: unknown) {
  return variant.actions.some(candidate => candidate === action)
}

function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && 'value' in Object.getOwnPropertyDescriptor(value, key)!)
}
export function readIntentReply(value: unknown): IntentReply | null {
  if (!plain(value)) return null
  if (INTENT_REFUSAL_STATUSES.some(status => status === value.status)) {
    return Object.keys(value).length === 1 ? value as IntentReply : null
  }
  if (value.status !== 'intent' || Object.keys(value).length !== 2 || !plain(value.intent)) return null
  const intent = value.intent, kind = intent.kind
  if (typeof kind !== 'string' || !Object.hasOwn(INTENT_VARIANTS, kind)) return null
  const variant = INTENT_VARIANTS[kind as NaturalIntent['kind']].find(candidate => allowsAction(candidate, intent.action))
  if (!variant) return null
  const allowedFields = [...INTENT_COMMON_FIELDS, ...variant.fields]
  if (Object.keys(intent).some(key => key !== 'kind' && key !== 'action' && !allowedFields.some(field => field === key))) return null
  for (const key of allowedFields) {
    if (!Object.hasOwn(intent, key)) continue
    const field = intent[key], rule = INTENT_FIELD_RULES[key]
    if (rule.type === 'integer') {
      if (typeof field !== 'number' || !Number.isSafeInteger(field) || field < rule.minimum || field > rule.maximum) return null
    } else if (typeof field !== 'string' || ('enum' in rule && !rule.enum.some(candidate => candidate === field))
      || ('pattern' in rule && !rule.pattern.test(field))) return null
  }
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
const normalized = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ', 'd').replace(/\s+/g, ' ')
export function readVndAmount(value: string): number | undefined {
  const text = value.trim()
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(text)) return undefined
  const amount = Number(text.replace(/[.,]/g, ''))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined
}
function withoutNumericReferences(text: string) {
  return text.replace(/(?:quyet dinh|vong|luot|ky han)\s*(?:(?:so|thu)\s+)?\d+(?:\s*start)?|\d+\s*start|bond-\d+|lot\s*\d+/g, '')
}
const vndExpression = /\d[\d.,]*\s*(?:(?:trieu|tr|nghin|ngan|k|ty|vnd|dong|d)\b|₫)|\b(?:so tien|ngan sach)\s*[+\-−]?\s*\d/
const foreignCurrency = /(?<!\p{L})(?:dollars?|euros?|do la|yen|won|nhan dan te)(?!\p{L})|(?!₫)\p{Sc}/u
const foreignCodes = new Set([...Intl.supportedValuesOf('currency').filter(code => code !== 'VND').map(code => code.toLowerCase()),
  'rmb', 'btc', 'eth'])
const prefixCurrency = /(?<!\p{L})([a-z]{3})(?!\p{L})\s*[:(]?\s*(?=[+\-−]?\s*\d)/gu
const suffixCurrency = /\d[\d.,]*\s*(?:(?:trieu|tr|nghin|ngan|k|ty)\b\s*)?(?:(?:vnd|dong|d)\b\s*|₫\s*)?\(?\s*([a-z]{3})(?!\p{L})/gu
const shareQuantity = /\d[\d.,]*\s*(?:(?:trieu|tr|nghin|ngan|k|ty)\s+)?(?:co phieu|co phan|shares?|cp)\b|(?:\bmoi\s+|\/\s*)(?:co phieu|co phan|shares?|cp)\b/

function unsupportedMoney(text: string) {
  return /\d/.test(text) && (foreignCurrency.test(text) || vndExpression.test(text) && shareQuantity.test(text)
    || [...text.matchAll(prefixCurrency), ...text.matchAll(suffixCurrency)].some(match => foreignCodes.has(match[1])))
}

function monetary(text: string): number | undefined {
  if (/[-−]\s*\d/.test(text.replace(/bond-\d+/g, ''))) return undefined
  const cleaned = withoutNumericReferences(text)
  if (!vndExpression.test(cleaned) || unsupportedMoney(cleaned)) return undefined
  const numbers = [...cleaned.matchAll(/(?<![\p{L}\p{N}_])([0-9]+(?:[.,][0-9]+)*)(?:\s*(trieu|tr|nghin|ngan|k|ty))?(?:\s*(vnd\b|dong\b|d\b|₫))?(?![\p{L}\p{N}_]|[.,][0-9])/gu)]
  if (numbers.length !== 1) return undefined
  const [match, raw, unit, currency] = numbers[0]
  const scale = unit === 'ty' ? 1_000_000_000 : unit === 'trieu' || unit === 'tr' ? 1_000_000 : ['nghin', 'ngan', 'k'].includes(unit) ? 1000 : 1
  // A bare Vietnamese multiplier or labelled budget must end the amount phrase.
  const suffix = cleaned.slice(numbers[0].index + match.length).trimStart()
  if (!currency && suffix && !/^(?:[?!.,;)]|(?:thi|tai|o|vao|trong|lan|dau tien|cuoi cung|ky han)\b)/.test(suffix)) return undefined
  if (scale === 1) return readVndAmount(raw)
  if (/[.,]\d{3}$/.test(raw)) return undefined
  const amount = Number(raw.replace(',', '.')) * scale
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined
}
const bankTermPattern = /(?<![\p{L}\p{N}_])(?:ky han\s*([+\-−]?\s*\p{N}+(?:[.,]\p{N}+)*)(\s*start)?|([+\-−]?\p{N}+(?:[.,]\p{N}+)*)\s*start)(?![\p{L}\p{N}_])/gu
const bankTermMention = /\bky han\s*[+\-−]?\s*\p{N}|\p{N}\s*start\b/u
const calendarTerm = /^(?:ngay|tuan|thang|nam|gio|phut|giay|vong(?!\s+\d)|chu ky)\b/

function bankTerm(text: string): 1 | 2 | 3 | undefined {
  const terms = [...text.matchAll(bankTermPattern)]
  if (terms.length !== 1) return undefined
  const [match, named, unit, standalone] = terms[0]
  const suffix = text.slice(terms[0].index + match.length)
  if (hasUnresolvedNumberSuffix(suffix) || calendarTerm.test(suffix.trimStart())) return undefined
  // A labelled bare term uses the game's existing START convention.
  if (!unit && !standalone && suffix.trimStart() && !/^\s*(?:[?!.,;)]|(?:thi|tai|o|vao|lan)\b)/.test(suffix)) return undefined
  const raw = named ?? standalone
  return raw === '1' ? 1 : raw === '2' ? 2 : raw === '3' ? 3 : undefined
}
export const TRUSTED_INTENT_FIELDS = ['sequence', 'lap', 'turn', 'occurrence', 'amount', 'term'] as const
type TrustedIntentFacts = Pick<NaturalIntent, (typeof TRUSTED_INTENT_FIELDS)[number]>
const numericLocatorPatterns = {
  sequence: /(?<![\p{L}\p{N}_])quyet dinh\s*(?:(?:so|thu)\s+)?([+\-−]?\s*\p{N}+(?:[.,]\p{N}+)*)/gu,
  lap: /(?<![\p{L}\p{N}_])vong\s*(?:(?:so|thu)\s+)?([+\-−]?\s*\p{N}+(?:[.,]\p{N}+)*)/gu,
  turn: /(?<![\p{L}\p{N}_])luot\s*(?:(?:so|thu)\s+)?([+\-−]?\s*\p{N}+(?:[.,]\p{N}+)*)/gu,
} as const

function hasUnresolvedNumberSuffix(suffix: string) {
  return /^[\p{L}\p{M}\p{N}_:/\p{Pd}]/u.test(suffix)
    || /^\s*(?:[.,;:/&+\p{Pd}]|[,;]?\s*(?:va|hoac|hay|den|toi)\s+)\s*[+\-−]?\s*\p{N}/u.test(suffix)
}

function explicitHistory(text: string): Pick<TrustedIntentFacts, 'sequence' | 'lap' | 'turn' | 'occurrence'> | null {
  const facts: Pick<TrustedIntentFacts, 'sequence' | 'lap' | 'turn' | 'occurrence'> = {}
  for (const field of ['sequence', 'lap', 'turn'] as const) {
    const matches = [...text.matchAll(numericLocatorPatterns[field])]
    if (!matches.length) continue
    const [match, raw] = matches[0]
    const value = Number(raw)
    if (matches.length !== 1 || !/^\d+$/.test(raw.trim())
      || !Number.isSafeInteger(value) || value < 1 || value > INTENT_FIELD_RULES[field].maximum
      || hasUnresolvedNumberSuffix(text.slice(matches[0].index + match.length))) return null
    facts[field] = value
  }
  const first = /\b(?:lan dau|dau tien)\b/.test(text)
  const last = /\b(?:lan cuoi|cuoi cung)\b/.test(text)
  if (first && last) return null
  if (first || last) facts.occurrence = first ? 'first' : 'last'
  return facts
}

/** Only explicit, unambiguous text may supply a history locator or financial parameter. */
export function extractTrustedIntentFacts(question: string): { status: 'facts'; facts: TrustedIntentFacts } | { status: 'ambiguous' } {
  const text = normalized(question)
  const facts: TrustedIntentFacts | null = explicitHistory(text)
  if (!facts) return { status: 'ambiguous' }

  if (bankTermMention.test(text)) {
    const term = bankTerm(text)
    if (term === undefined) return { status: 'ambiguous' }
    facts.term = term
  }
  const moneyText = withoutNumericReferences(text)
  if (unsupportedMoney(moneyText)) return { status: 'ambiguous' }
  if (vndExpression.test(moneyText)) {
    const amount = monetary(text)
    if (amount === undefined) return { status: 'ambiguous' }
    facts.amount = amount
  }
  return { status: 'facts', facts }
}

export function hasExplicitFinancialParameters(question: string, intent: NaturalIntent): boolean {
  const text = normalized(question)
  return (intent.amount === undefined || monetary(text) === intent.amount)
    && (intent.term === undefined || bankTerm(text) === intent.term)
}
/** Conservative Vietnamese grammar used when no language provider is available. */
export function interpretDeterministically(question: string): IntentReply {
  const text = normalized(question)
  if (/[-−]\s*\d/.test(text.replace(/bond-\d+/g, ''))) return { status: 'unsupported' }
  if (/\b(?:hoac|hay)\b/.test(text)) return { status: 'ambiguous' }
  if (bankTermMention.test(text) && bankTerm(text) === undefined || unsupportedMoney(withoutNumericReferences(text))) return { status: 'unsupported' }
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
  if (!action || !INTENT_VARIANTS[kind].some(variant => allowsAction(variant, action)) || kind === 'gold' && !/(?:bo(?: qua)?|khong) mua vang/.test(text)) return { status: 'unsupported' }
  const history = explicitHistory(text)
  if (!history) return { status: 'ambiguous' }
  const intent: NaturalIntent = { kind, action, ...history }
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
    if (kind === 'bank' && term !== undefined) intent.term = term
    if (kind === 'business' && action === 'upgrade') {
      if (/gia ca|budget/.test(text)) intent.preferenceId = 'budget'
      else if (/do uong|taste/.test(text)) intent.preferenceId = 'taste'
      else if (/check.in|khong gian/.test(text)) intent.preferenceId = 'checkin'
    }
  }
  return readIntentReply({ status: 'intent', intent }) ?? { status: 'unsupported' }
}

export { interpretDeterministically as interpretMock }
