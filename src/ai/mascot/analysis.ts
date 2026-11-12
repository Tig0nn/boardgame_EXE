import { isMascotFactId, MASCOT_RESPONSE_VERSION, MASCOT_TOPICS } from './contracts.ts'
import type { ExplanationContext, ExplanationReply, Facts, Topic } from './contracts.ts'

type ClaimKind = 'fact' | 'impact' | 'consideration'
type Claim = { id: string; kind: ClaimKind; factIds: readonly string[]; wording: readonly string[] }
export type AnalysisSentence = { claimIds: string[]; factIds: string[]; text: string }

const clause = (id: string, kind: ClaimKind, factIds: string[], ...wording: string[]): Claim =>
  ({ id, kind, factIds, wording })
const fact = (id: string, ids: string[], ...wording: string[]) => clause(id, 'fact', ids, ...wording)
const impact = (id: string, ids: string[], ...wording: string[]) => clause(id, 'impact', ids, ...wording)
const consider = (id: string, ids: string[], ...wording: string[]) => clause(id, 'consideration', ids, ...wording)

const groups: Record<string, string> = {
  gold: 'vàng', stocks: 'cổ phiếu', bonds: 'trái phiếu', business: 'cơ sở kinh doanh', savings: 'tiết kiệm',
}

function cashExhaustion(facts: Facts) {
  const asset = groups[String(facts.asset)]
  return [
    fact('cash-moved', ['asset', 'amount', 'cashBefore', 'cash'],
      facts.cash === 0 ? `toàn bộ tiền mặt trước giao dịch đã chuyển sang ${asset}` : `phần lớn tiền mặt trước giao dịch đã chuyển sang ${asset}`,
      facts.cash === 0 ? `giao dịch mua ${asset} đã dùng hết tiền mặt` : `giao dịch mua ${asset} để lại rất ít tiền mặt`),
    ...(facts.knownPayments === 0 ? [fact('no-payment-recorded', ['knownPayments'],
      'ván chưa ghi nhận khoản phải trả tại mốc này', 'chưa có nghĩa vụ thanh toán được ghi nhận')] : []),
    impact('less-immediate-cash', ['cashBefore', 'cash'],
      'nếu cần chi, bạn có ít tiền dùng ngay hơn trước giao dịch', 'phần ngân sách linh hoạt cho khoản chi mới đã giảm'),
    impact('held-versus-available', ['asset', 'cash'],
      'giá trị tài sản đang giữ chỉ thành tiền mặt khi bạn bán được theo luật game',
      'tài sản trong ví cần được chuyển thành tiền trước khi dùng để chi'),
    consider('check-sale', ['asset', 'cash'], facts.asset === 'gold'
      ? 'hãy kiểm tra lúc game cho phép bán vàng và số thực nhận sau phí, spread'
      : 'hãy kiểm tra lúc game cho phép bán và số thực nhận từ tài sản đã mua'),
  ]
}

export function mascotClaims({ topic, facts }: ExplanationContext): readonly Claim[] {
  switch (topic) {
    case 'cash-exhaustion': return cashExhaustion(facts)
    case 'buy':
    case 'upgrade': return [
      fact('cash-invested', ['cashBefore', 'cash', 'amount'], 'giao dịch đã dùng một phần tiền mặt cho tài sản', 'số dư tiền mặt đã giảm sau giao dịch'),
      impact('less-flexible', ['cash', 'amount'], 'phần vốn vừa chi không còn sẵn để thanh toán ngay'),
      impact('payment-unknown', ['cash'], 'riêng số dư sau giao dịch chưa đủ để kết luận có khoản thiếu cần thanh toán'),
      ...(facts.knownPayments === 0 ? [fact('no-recorded-buy-payment', ['knownPayments'], 'ván chưa ghi nhận khoản phải trả tại mốc này')] : []),
      consider('compare-reserve', ['cash'], 'hãy đối chiếu số dư với khoản phải trả mà game đã ghi nhận trước khi chi tiếp'),
    ]
    case 'payment-gap': return [
      fact('cash-below-payments', ['cash', 'knownPayments'], 'tổng khoản phải trả đã ghi nhận lớn hơn tiền mặt sẵn có'),
      ...(Number(facts.pending) > 0 ? [fact('payment-pending', ['pending'], 'game đang chờ xử lý khoản thanh toán bắt buộc')] : []),
      impact('funding-needed', ['cash', 'knownPayments'], 'phần thiếu cần một nguồn thanh toán hợp lệ nếu dùng hết tiền mặt'),
      consider('check-funding', ['cash', 'knownPayments'], 'hãy kiểm tra mốc thanh toán và số tiền thực nhận từ nguồn game cho phép'),
    ]
    case 'concentration': return [
      fact('dominant-group', ['group', 'value', 'gross', 'share'], `${groups[String(facts.group)]} chiếm phần lớn giá trị tài sản bạn đang giữ`),
      impact('conversion-restriction', ['group', 'share'], 'nếu cần huy động thêm tiền, khả năng sử dụng phần vốn này phụ thuộc điều kiện chuyển đổi trong ván'),
      impact('limited-cash-reserve', ['cash', 'knownPayments'], 'dành đủ tiền cho khoản đã ghi nhận sẽ dùng hơn nửa số dư tiền mặt'),
      consider('check-cash-separately', ['group', 'cash', 'knownPayments'], 'hãy kiểm tra riêng tiền mặt dự phòng và điều kiện game cho phép bán hoặc rút'),
    ]
    case 'repay':
    case 'debt-reduced': return [
      fact('principal-down', ['debtReduced'], 'gốc còn phải theo dõi đã giảm'),
      impact('cash-separate', ['debtReduced', 'cash'], 'tiền mặt còn lại và phần gốc giảm đo hai tác động khác nhau của giao dịch',
        'số dư tiền mặt có thể còn phản ánh các khoản thu chi khác trong cùng lượt'),
      consider('check-reserve-after-debt', ['cash', 'debtReduced'], 'hãy xem phần tiền mặt còn lại trước khi chi thêm hoặc trả nợ tiếp'),
    ]
    case 'deposit': return [
      fact('fixed-term', ['amount', 'term', 'maturityLap'], 'khoản gửi vừa mở có mốc đáo hạn theo dữ kiện của ván'),
      impact('early-withdrawal', ['amount', 'maturityLap'], 'nếu cần rút sớm để xử lý khoản thiếu bắt buộc, game yêu cầu rút toàn bộ khoản và bạn mất phần lãi'),
      consider('match-maturity', ['cash', 'maturityLap', 'knownPayments'], 'hãy so mốc đáo hạn với khoản cần trả và tiền mặt còn giữ'),
    ]
    case 'debt': return [
      fact('principal-vs-cash', ['debt', 'cash'], 'gốc đang bằng hoặc vượt tiền mặt hiện có'),
      impact('repayment-uses-cash', ['debt', 'cash'], 'nếu trả gốc bằng tiền mặt, phần dành cho khoản chi khác sẽ giảm'),
      consider('check-game-due', ['debt', 'cash'], 'hãy xem số tiền game yêu cầu tại bước trả nợ trước khi dành tiền cho giao dịch khác'),
    ]
    case 'borrow': return [
      fact('loan-funded-payment', ['amount', 'paid'], 'khoản vay đã được dùng để hỗ trợ thanh toán'),
      impact('principal-in-wallet', ['amount', 'debt'], 'phần vay làm tăng số gốc cần theo dõi sau khi xử lý khoản trả'),
      consider('track-principal', ['debt'], 'hãy kiểm tra gốc còn lại khi game báo tới bước trả nợ'),
    ]
    case 'sell': return [
      fact('cash-from-sale', ['cashBefore', 'cash', 'amount'], 'số tiền thực nhận từ bán tài sản đã tăng tiền mặt'),
      impact('holding-reduced', ['amount', 'cash'], 'giao dịch chuyển một phần vốn nắm giữ sang tiền dùng ngay'),
      consider('reserve-sale-proceeds', ['cash'], 'hãy đối chiếu số dư mới với khoản cần trả trước khi dùng số tiền đó'),
    ]
    case 'coverage-restored': return [
      fact('covers-payments', ['cash', 'knownPayments'], 'tiền mặt hiện đủ cho khoản phải trả đã ghi nhận'),
      impact('reserve-first', ['cash', 'knownPayments'], 'chỉ phần còn lại sau khi dành tiền cho các khoản đó mới linh hoạt để chi thêm'),
      consider('check-free-budget', ['cash', 'knownPayments'], 'hãy kiểm tra phần tiền còn dùng được trước giao dịch tiếp theo'),
    ]
    case 'goal-progress': return [
      fact('goal-closer', ['improvement', 'remaining'], 'khoảng cách tới mục tiêu của ván đã thu hẹp'),
      impact('realisable-value', ['remaining', 'target'], 'tiến độ dựa trên số có thể huy động hợp lệ theo game và có thể khác tổng tài sản trong ví'),
      consider('check-gap', ['remaining', 'target'], 'hãy kiểm tra số còn thiếu và nguồn tiền được tính vào mục tiêu'),
    ]
    case 'cash-drop': return [
      fact('lower-cash', ['cash', 'cashDrop'], 'lượng tiền mặt có thể dùng ngay đã giảm'),
      impact('payment-not-proven', ['cash'], 'mức giảm này riêng lẻ chưa cho biết có khoản thiếu để thanh toán'),
      consider('check-recorded-payments', ['cash'], 'hãy so số dư với khoản phải trả đã ghi nhận trước lần chi tiếp theo'),
    ]
  }
}

export const mascotCauseLinks = [
  ['cash-moved', 'less-immediate-cash'], ['cash-invested', 'less-flexible'], ['cash-below-payments', 'funding-needed'],
] as const
const connector = [', đồng thời ', ' và '] as const
const causalConnector = ', vì vậy '
export function requiredMascotClaimId(topic: Topic) {
  if (topic === 'cash-exhaustion') return 'less-immediate-cash'
  if (topic === 'concentration') return 'limited-cash-reserve'
}

// Include conditional claims solely to recognize safe IDs in diagnostics.
const knownClaimIds = new Set(MASCOT_TOPICS.flatMap(topic =>
  mascotClaims({ version: 1, topic, facts: { asset: 'gold', group: 'gold', knownPayments: 0, pending: 1 } })
    .map(claim => claim.id)))
const sentence = (text: string) => text[0].toLocaleUpperCase('vi-VN') + text.slice(1) + '.'
export const factIdsFor = (claims: readonly Claim[]) => [...new Set(claims.flatMap(claim => claim.factIds))].sort()
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')

function sentenceRejection(claims: Claim[], text: string) {
  if (claims.length === 1) {
    return claims[0].wording.some(part => sentence(part) === text) ? null : 'INVALID_SENTENCE_STRUCTURE'
  }
  const [first, second] = claims
  const matches = (join: string) =>
    first.wording.some(left => second.wording.some(right => sentence(left + join + right) === text))
  if (connector.some(matches)) return null
  if (!matches(causalConnector)) return 'INVALID_SENTENCE_STRUCTURE'
  return mascotCauseLinks.some(([from, to]) => first.id === from && second.id === to)
    ? null : 'UNSUPPORTED_CAUSAL_RELATION'
}

export type AnalysisDiagnostic = {
  stage: 'schema' | 'claims'
  topic: Topic
  category: 'UNKNOWN_CLAIM_ID' | 'UNKNOWN_FACT_ID' | 'TOPIC_CLAIM_MISMATCH' | 'CLAIM_FACT_MISMATCH'
    | 'UNSUPPORTED_CAUSAL_RELATION' | 'INVALID_SENTENCE_STRUCTURE' | 'OTHER'
  reason: 'analysis-count' | 'line-shape' | 'root-shape' | 'wrong-topic' | 'claim-allowlist' | 'duplicate-claim'
    | 'claim-order' | 'fact-allowlist' | 'fact-links' | 'causal-link' | 'wording' | 'required-claim' | 'claim-coverage'
  sentenceIndex?: number
  claimId?: string
  factId?: string
}
type AnalysisRejection = (diagnostic: AnalysisDiagnostic) => void

function isAnalysisLine(line: unknown): line is AnalysisSentence {
  return record(line) && exact(line, ['claimIds', 'factIds', 'text']) && strings(line.claimIds)
    && line.claimIds.length >= 1 && line.claimIds.length <= 2 && strings(line.factIds)
    && line.factIds.length >= 1 && line.factIds.length <= 8 && typeof line.text === 'string' && line.text.length <= 300
}

export function readMascotAnalysis(value: unknown, context: ExplanationContext, onReject?: AnalysisRejection): AnalysisSentence[] | null {
  const reject = (stage: AnalysisDiagnostic['stage'], category: AnalysisDiagnostic['category'],
    reason: AnalysisDiagnostic['reason'], sentenceIndex?: number, claimId?: string, factId?: string) => {
    onReject?.({
      stage, topic: context.topic, category, reason,
      ...(sentenceIndex === undefined ? {} : { sentenceIndex }),
      ...(claimId && knownClaimIds.has(claimId) ? { claimId } : {}),
      ...(factId && isMascotFactId(factId) ? { factId } : {}),
    })
    return null
  }
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) return reject('schema', 'OTHER', 'analysis-count')
  const invalidIndex = Array.from(value).findIndex(line => !isAnalysisLine(line))
  if (invalidIndex !== -1) return reject('schema', 'INVALID_SENTENCE_STRUCTURE', 'line-shape', invalidIndex)
  const catalog = new Map(mascotClaims(context).map(claim => [claim.id, claim]))
  const seen = new Set<string>()
  const kinds = new Set<ClaimKind>()
  const result: AnalysisSentence[] = []
  for (const [index, line] of value.entries()) {
    const claims: Claim[] = []
    for (const id of line.claimIds) {
      const claim = catalog.get(id)
      if (!claim) {
        return reject('claims', knownClaimIds.has(id) ? 'TOPIC_CLAIM_MISMATCH' : 'UNKNOWN_CLAIM_ID', 'claim-allowlist', index, id)
      }
      if (seen.has(id)) return reject('claims', 'INVALID_SENTENCE_STRUCTURE', 'duplicate-claim', index, id)
      if ((claim.kind === 'consideration') !== (index === value.length - 1)) {
        return reject('claims', 'INVALID_SENTENCE_STRUCTURE', 'claim-order', index, id)
      }
      seen.add(id)
      kinds.add(claim.kind)
      claims.push(claim)
    }
    const supporting = factIdsFor(claims)
    const provided = [...line.factIds].sort()
    const foreignFact = provided.find(id => !Object.hasOwn(context.facts, id))
    if (foreignFact !== undefined) return reject('claims', 'UNKNOWN_FACT_ID', 'fact-allowlist', index, claims[0].id, foreignFact)
    if (supporting.length !== provided.length || supporting.some((id, i) => id !== provided[i])) {
      const mismatched = provided.find((id, i) => !supporting.includes(id) || provided[i - 1] === id)
        ?? supporting.find(id => !provided.includes(id))
      return reject('claims', 'CLAIM_FACT_MISMATCH', 'fact-links', index, claims[0].id, mismatched)
    }
    const sentenceError = sentenceRejection(claims, line.text)
    if (sentenceError) {
      const reason = sentenceError === 'UNSUPPORTED_CAUSAL_RELATION' ? 'causal-link' : 'wording'
      return reject('claims', sentenceError, reason, index, claims[0].id)
    }
    result.push({ claimIds: [...line.claimIds], factIds: supporting, text: line.text })
  }
  const requiredClaim = requiredMascotClaimId(context.topic)
  if (requiredClaim && !seen.has(requiredClaim)) return reject('claims', 'INVALID_SENTENCE_STRUCTURE', 'required-claim', undefined, requiredClaim)
  return kinds.size === 3 ? result : reject('claims', 'INVALID_SENTENCE_STRUCTURE', 'claim-coverage')
}

export function readProviderAnalysis(value: unknown, context: ExplanationContext, onReject?: AnalysisRejection) {
  if (!record(value) || !exact(value, ['topic', 'analysis'])) {
    onReject?.({ stage: 'schema', topic: context.topic, category: 'OTHER', reason: 'root-shape' })
    return null
  }
  if (value.topic !== context.topic) {
    onReject?.({ stage: 'schema', topic: context.topic, category: 'TOPIC_CLAIM_MISMATCH', reason: 'wrong-topic' })
    return null
  }
  return readMascotAnalysis(value.analysis, context, onReject)
}

export function readExplanationReply(value: unknown, context: ExplanationContext): ExplanationReply | null {
  if (!record(value) || !exact(value, ['version', 'topic', 'analysis', 'source']) || value.version !== MASCOT_RESPONSE_VERSION
    || value.topic !== context.topic || (value.source !== 'mock' && value.source !== 'live')) return null
  const analysis = readMascotAnalysis(value.analysis, context)
  return analysis ? { version: MASCOT_RESPONSE_VERSION, topic: context.topic, analysis, source: value.source } : null
}

export function mockMascotAnalysis(context: ExplanationContext): AnalysisSentence[] {
  return mascotClaims(context).map(claim => ({ claimIds: [claim.id], factIds: factIdsFor([claim]), text: sentence(claim.wording[0]) }))
}
