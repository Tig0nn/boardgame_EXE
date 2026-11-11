export type WhatIfDecision = {
  kind: 'gold' | 'bank' | 'course' | 'advanced' | 'stocks' | 'bonds' | 'business'
  decisionId: string
  alternativeId: 'skip' | 'deposit-one-start' | 'course-basic' | 'course-advanced'
    | 'buy-stocks' | 'sell-stocks' | `buy-bonds:${string}` | `sell-bonds:${string}`
    | 'buy-business' | 'sell-business' | `upgrade-business:${string}`
    | `custom:${string}`
  lap: number
  turn: number
  parameters?: DecisionParameters
}

export type DecisionParameters = { operation: 'buy' | 'sell' | 'deposit'; amount: number;
  symbolId?: string; issuerId?: string; lotId?: string; term?: 1 | 2 | 3 }

/** Closed scalar parameters only. The native prefix probe remains the authority for affordability and access. */
export function parameterAlternativeId(kind: string, input: unknown): `custom:${string}` | null {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) return null
  const descriptors = Object.getOwnPropertyDescriptors(input)
  if (Reflect.ownKeys(input).some(key => typeof key !== 'string' || !('value' in descriptors[key]))) return null
  const value = input as Record<string, unknown>
  if (!Number.isSafeInteger(value.amount) || Number(value.amount) <= 0) return null
  let keys: string[], target: string
  if (kind === 'stocks' && (value.operation === 'buy' || value.operation === 'sell')
    && typeof value.symbolId === 'string' && /^[A-Z0-9-]{1,16}$/.test(value.symbolId)) {
    keys = ['amount', 'operation', 'symbolId']; target = value.symbolId
  } else if (kind === 'bonds' && value.operation === 'buy' && ['an-tam', 'but-pha'].includes(String(value.issuerId))) {
    keys = ['amount', 'issuerId', 'operation']; target = String(value.issuerId)
  } else if (kind === 'bonds' && value.operation === 'sell' && typeof value.lotId === 'string' && /^bond-[1-9][0-9]{0,2}$/.test(value.lotId)) {
    keys = ['amount', 'lotId', 'operation']; target = value.lotId
  } else if (kind === 'bank' && value.operation === 'deposit' && [1, 2, 3].includes(Number(value.term)) && typeof value.term === 'number') {
    keys = ['amount', 'operation', 'term']; target = String(value.term)
  } else return null
  if (Object.keys(input).sort().join(',') !== keys.join(',')) return null
  return `custom:${kind}:${String(value.operation)}:${target}:${Number(value.amount)}`
}

export function parameterQuestion(choice: WhatIfDecision): string {
  const p = choice.parameters
  if (!p) return ''
  const sequence = choice.decisionId.split(':')[1]
  if (choice.kind === 'bank') return `Gửi tiết kiệm số tiền ${p.amount} kỳ hạn ${p.term} tại quyết định ${sequence}`
  const verb = p.operation === 'buy' ? 'Mua' : 'Bán'
  const asset = choice.kind === 'stocks' ? `cổ phiếu ${p.symbolId}`
    : p.operation === 'buy' ? `trái phiếu ${p.issuerId === 'an-tam' ? 'An Tâm' : 'Bứt Phá'}` : `trái phiếu lot ${p.lotId}`
  return `${verb} ${asset} số tiền ${p.amount} tại quyết định ${sequence}`
}

export type ExplanationFacts = {
  kind: WhatIfDecision['kind']
  direction: 'up' | 'down' | 'unchanged'
  confirmedFollowUp: boolean
}

/** Future Gemini transport belongs on the server. Replies cross this boundary as untrusted data. */
export interface WhatIfProvider {
  interpret?(input: { question: string }, signal: AbortSignal): Promise<unknown>
  propose(input: { question: string; catalog: WhatIfDecision[] }, signal: AbortSignal): Promise<unknown>
  explain(facts: ExplanationFacts, signal: AbortSignal): Promise<unknown>
}

export const QUESTION_LIMIT = 240
export const WHAT_IF_KINDS = ['gold', 'bank', 'course', 'advanced', 'stocks', 'bonds', 'business'] as const

export function validAlternative(kind: string, value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (kind === 'bonds') return value === 'skip' || /^buy-bonds:(?:an-tam|but-pha)$/.test(value) || /^sell-bonds:bond-[1-9][0-9]{0,2}$/.test(value)
  if (kind === 'business') return ['skip', 'buy-business', 'sell-business'].includes(value) || /^upgrade-business:(?:checkin|budget|taste)$/.test(value)
  const choices: Record<string, string[]> = { gold: ['skip'], bank: ['skip', 'deposit-one-start'], course: ['skip', 'course-basic'],
    advanced: ['skip', 'course-basic', 'course-advanced'], stocks: ['skip', 'buy-stocks', 'sell-stocks'] }
  if (kind === 'course' && value === 'course-advanced') return true
  return Object.hasOwn(choices, kind) && choices[kind].includes(value)
}

export function alternativeLabel(choice: WhatIfDecision): string {
  if (choice.parameters && parameterAlternativeId(choice.kind, choice.parameters) === choice.alternativeId) {
    const p = choice.parameters, amount = new Intl.NumberFormat('vi-VN').format(p.amount) + ' ₫'
    if (choice.kind === 'bank') return `Gửi ${amount}, kỳ hạn ${p.term} START`
    const target = p.symbolId ?? p.lotId ?? (p.issuerId === 'an-tam' ? 'An Tâm' : 'Bứt Phá')
    return `${p.operation === 'buy' ? 'Mua' : 'Bán'} ${target} với số tiền ${amount}`
  }
  const names: Record<string, string> = { 'deposit-one-start': 'Gửi tiết kiệm một kỳ START với ngân sách giả định 5.000.000 ₫',
    'course-basic': 'Học khóa cơ bản', 'course-advanced': 'Học khóa nâng cao',
    'buy-stocks': 'Mua mã đầu danh sách đang mở với ngân sách giả định 5.000.000 ₫', 'sell-stocks': 'Bán toàn bộ cổ phiếu',
    'buy-business': 'Mua cơ sở theo giá vốn trong luật chơi', 'sell-business': 'Bán toàn bộ cơ sở',
    'buy-bonds:an-tam': 'Mua trái phiếu An Tâm với ngân sách giả định 5.000.000 ₫',
    'buy-bonds:but-pha': 'Mua trái phiếu Bứt Phá với ngân sách giả định 5.000.000 ₫',
    'upgrade-business:checkin': 'Nâng cấp không gian check-in', 'upgrade-business:budget': 'Nâng cấp giá cả hợp lý', 'upgrade-business:taste': 'Nâng cấp chất lượng đồ uống' }
  if (choice.alternativeId === 'skip') return choice.kind === 'gold' ? 'Bỏ qua lần mua vàng' : 'Bỏ qua quyết định đã ghi nhận'
  if (choice.alternativeId.startsWith('sell-bonds:')) return `Bán toàn bộ khoản trái phiếu ${choice.alternativeId.split(':')[1]}`
  return names[choice.alternativeId] ?? 'Phương án trong catalog đã xác minh'
}

function stringFields(value: unknown, keys: string[]): string[] | null {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length) return null
  const fields = keys.map(key => Object.getOwnPropertyDescriptor(value, key)?.value as unknown)
  return fields.every(field => typeof field === 'string' && field.length <= 64) ? fields as string[] : null
}

export async function runWhatIfPrompt(
  provider: WhatIfProvider, question: string, catalog: readonly WhatIfDecision[], signal: AbortSignal,
  replay: (decision: WhatIfDecision) => Promise<void>,
): Promise<'submitted' | 'unsupported'> {
  signal.throwIfAborted()
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > QUESTION_LIMIT || !catalog.length || catalog.length > 16) return 'unsupported'
  const choices = structuredClone([...catalog])
  const reply = await provider.propose({ question: trimmed, catalog: structuredClone(choices) }, signal)
  signal.throwIfAborted()
  const ids = stringFields(reply, ['decisionId', 'alternativeId'])
  if (!ids) return 'unsupported'
  const matches = choices.filter(choice => choice.decisionId === ids[0] && choice.alternativeId === ids[1])
  if (matches.length !== 1) return 'unsupported'
  await replay(matches[0])
  signal.throwIfAborted()
  return 'submitted'
}

export function explanationClaim({ kind, direction }: ExplanationFacts) {
  return `${kind}-${direction}`
}

export async function explainWhatIf(provider: WhatIfProvider, facts: ExplanationFacts, signal: AbortSignal, flexible = false) {
  signal.throwIfAborted()
  const expected = explanationClaim(facts)
  const reply = await provider.explain({ ...facts }, signal)
  signal.throwIfAborted()
  if (stringFields(reply, ['claimId'])?.[0] !== expected) return null
  const assetNames = { stocks: 'cổ phiếu', bonds: 'trái phiếu', business: 'kinh doanh', advanced: 'khóa nâng cao' }
  const choice = facts.kind in assetNames ? `Phương án thay đổi quyết định ${assetNames[facts.kind as keyof typeof assetNames]}`
    : facts.kind === 'course' ? 'Phương án thay đổi lần học'
    : facts.kind === 'bank' ? flexible ? 'Phương án thay đổi quyết định ngân hàng' : 'Phương án gửi tiết kiệm một kỳ START'
    : facts.confirmedFollowUp ? 'Phương án bỏ qua lần mua vàng và bỏ qua lần bán đã xác nhận'
      : 'Phương án bỏ qua lần mua vàng'
  const effect = { up: 'cao hơn', down: 'thấp hơn', unchanged: 'bằng' }[facts.direction]
  return `${choice} có tiền mặt cuối ván ${effect} ván đã chơi. So sánh dựa trên cùng diễn biến đã phát lại.`
}
