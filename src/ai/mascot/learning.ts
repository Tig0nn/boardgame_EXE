import { SCENARIOS } from '../../data/config.ts'
import { EVENTS } from '../../data/events.ts'
import { MULTI_COURSES } from '../../data/courses.ts'
import { money } from '../../game/format.ts'
import { isMascotPurchaseAsset } from './contracts.ts'
import { learningKnowledge } from './learning-knowledge.ts'
import type { LearningScope } from './learning-knowledge.ts'

export const LEARNING_ENDPOINT = '/api/mascot-learning'
export const QUESTION_LIMIT = 280
export const LEARNING_BODY_LIMIT = 4096
export const LEARNING_DEADLINE = 15_000
export const INSUFFICIENT = 'Mình chưa có đủ dữ kiện trong ván để trả lời chắc chắn. Bạn có thể hỏi rõ về một giao dịch, sự kiện hoặc thuật ngữ EXE.'

const assets = { gold: 'vàng', stocks: 'cổ phiếu', bonds: 'trái phiếu', business: 'kinh doanh' }
export const learningKinds = ['buy', 'sell', 'deposit', 'withdraw', 'repay', 'upgrade', 'encounter', 'decision', 'funding', 'settlement', 'market', 'insolvency'] as const
type LearningKind = typeof learningKinds[number]
const labels: Record<LearningKind, string> = {
  buy: 'Mua tài sản', sell: 'Bán tài sản', deposit: 'Gửi tiết kiệm', withdraw: 'Rút tiết kiệm', repay: 'Trả nợ',
  upgrade: 'Nâng cấp', encounter: 'Gặp sự kiện', decision: 'Quyết định', funding: 'Huy động tiền',
  settlement: 'Tổng kết vòng', market: 'Cập nhật thị trường', insolvency: 'Mất khả năng thanh toán',
}
const events = new Map(EVENTS.map(event => [event.id, event]))
export const isLearningEvent = (id: unknown): id is string => typeof id === 'string' && events.has(id)
export function learningChoiceLabel(eventId: string | null, choice: unknown) {
  if (!eventId || typeof choice !== 'string') return null
  if (eventId === 'course') {
    const course = MULTI_COURSES.find(item => 'course-' + item.id === choice)
    if (course) return 'Mua ' + course.name.toLowerCase()
  }
  const option = events.get(eventId)?.options.find(item => item.id === choice)
  if (!option) return null
  if (choice === 'pay') return 'Thanh toán ngay'
  if (eventId === 'repair' && choice === 'full') return 'Sửa ngay'
  if (eventId === 'course' && choice === 'upgrade') return 'Tham gia khóa học'
  return option.label
}
export type LearningEntry = {
  id: number; lap: number; kind: LearningKind; asset: keyof typeof assets | null; event: string | null; choice: string | null
  amount: number | null; before: number; after: number; obligations: number
}
export type LearningContext = {
  cash: number; obligations: number; lap: number; scenario: string; entries: LearningEntry[]
  result: { won: boolean; insolvent: boolean; funds: number; target: number; worth: number; requiredRounds?: number } | null
  gold: { before: number; after: number; lap: number } | null
}
export type LearningCard = { id: string; scope: LearningScope; source: string; text: string }
export type LearningReply = { source: 'offline' | 'mock' | 'gemini' | 'fallback'; ids: string[] }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const amount = (value: unknown, signed = false): value is number => integer(value, signed ? -1e12 : 0, 1e12)
const lap = (value: unknown): value is number => integer(value, 1, 12)
function entry(value: unknown): value is LearningEntry {
  return exact(value, ['id', 'lap', 'kind', 'asset', 'event', 'choice', 'amount', 'before', 'after', 'obligations'])
    && integer(value.id, 0, 100_000) && lap(value.lap) && learningKinds.some(kind => kind === value.kind)
    && (value.asset === null || isMascotPurchaseAsset(value.asset)) && (value.event === null || isLearningEvent(value.event))
    && (value.choice === null || value.kind === 'decision' && learningChoiceLabel(value.event, value.choice) !== null)
    && (value.amount === null || amount(value.amount)) && amount(value.before) && amount(value.after) && amount(value.obligations)
}
export function readLearningContext(value: unknown): LearningContext | null {
  if (!exact(value, ['cash', 'obligations', 'lap', 'scenario', 'entries', 'result', 'gold'])
    || !amount(value.cash) || !amount(value.obligations) || !lap(value.lap)
    || !SCENARIOS.some(item => item.id === value.scenario)
    || !Array.isArray(value.entries) || value.entries.length > 6 || !value.entries.every(entry)
    || new Set(value.entries.map(item => item.id)).size !== value.entries.length) return null
  const { result, gold } = value
  if (result !== null && (!exact(result, ['won', 'insolvent', 'funds', 'target', 'worth', ...(object(result) && Object.hasOwn(result, 'requiredRounds') ? ['requiredRounds'] : [])])
    || typeof result.won !== 'boolean' || typeof result.insolvent !== 'boolean'
    || (Object.hasOwn(result, 'requiredRounds') && !lap(result.requiredRounds))
    || !amount(result.funds, true) || !amount(result.target) || result.target <= 0 || !amount(result.worth, true)
    || result.won && (result.insolvent || result.funds < result.target))) return null
  if (gold !== null && (!exact(gold, ['before', 'after', 'lap'])
    || !amount(gold.before) || !amount(gold.after) || !lap(gold.lap))) return null
  return value as LearningContext
}
export function readLearningQuestion(value: unknown) {
  if (typeof value !== 'string' || value.length > QUESTION_LIMIT || /\p{Cc}/u.test(value)) return null
  const question = value.trim()
  return question.length >= 3 ? question : null
}
export function readLearningRequest(value: unknown) {
  if (!exact(value, ['question', 'context'])) return null
  const question = readLearningQuestion(value.question)
  const context = readLearningContext(value.context)
  return question && context ? { question, context } : null
}

export const foldLearning = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
const card = (id: string, source: string, text: string, scope: LearningScope = source === 'Luật EXE' ? 'EXE_RULE' : 'GAME_FACT'): LearningCard =>
  ({ id, scope, source, text })
const scopeLabels: Record<LearningScope, string> = {
  GENERAL_FINANCE: 'Kiến thức tài chính', EXE_RULE: 'Luật EXE', GAME_FACT: 'Dữ kiện ván', UNKNOWN: 'Giới hạn dữ kiện',
}
const verifiedKnowledge = learningKnowledge.map(({ id, scope, text }) => card(id, scopeLabels[scope], text, scope))
const rules = 'Luật EXE'
const history = 'Nhật ký ván'
const glossary = [
  ...SCENARIOS.map(item => card(item.id, rules, item.label + ' là một bối cảnh thị trường trong EXE. ' + item.description)),
  card('liquidity', rules, 'Thanh khoản nói về khả năng huy động tiền để chi. Trong EXE, tiền mặt dùng được ngay. Bán hoặc rút tài sản còn tùy điều kiện của ván.'),
  card('goal-rule', rules, 'Kết quả EXE xét nguồn tiền huy động hợp lệ theo luật của ván. Con số này có thể khác tài sản ròng. Vốn kinh doanh chưa bán không được tính vào nguồn tiền huy động.'),
  card('gold-rule', rules, 'Trong EXE, vàng có thể tăng hoặc giảm. Khi bán, số thực nhận chịu chênh lệch giá mua bán và phí theo luật ván.'),
]
const readOnly = card('read-only', rules, 'Cáo chỉ trả lời câu hỏi về ván và luật EXE. Người chơi tự xác nhận giao dịch trên bàn cờ.')
const noForecast = card('no-forecast', history, 'Nhật ký được cung cấp không ghi dự đoán cá nhân trước đó. Mình không thể xác nhận kỳ vọng cũ hoặc nguyên nhân chênh lệch từ câu bạn vừa nhập.', 'UNKNOWN')
const noFinalResult = card('no-final-result', 'Trạng thái ván', 'Mình chưa có kết quả cuối ván để đối chiếu với mục tiêu.', 'UNKNOWN')
const noGoldHistory = card('no-gold-history', history, 'Nhật ký được cung cấp chưa có mốc biến động giá vàng trong ván để đối chiếu.', 'UNKNOWN')
const goldLiquidity = card('gold-liquidity', rules, 'Giữ vàng vẫn là giữ tài sản. Nếu phát sinh khoản chi trước khi game cho phép bán, bạn có ít tiền dùng ngay để xử lý. Khi bán được, hãy xem số thực nhận sau phí và chênh lệch giá mua bán (spread).')
const decisionImpact = card('decision-impact', history, 'Mình chưa đủ căn cứ để xác định quyết định nào ảnh hưởng lớn nhất. Nhật ký ghi lại những gì đã xảy ra. Muốn so tác động của từng lựa chọn cần đối chiếu những phương án có cùng điểm xuất phát và theo cùng luật EXE.', 'UNKNOWN')
const cashHypothesis = card('cash-hypothesis', rules, 'Nếu giữ thêm tiền mặt, bạn có thể dùng tiền để chi trả ngay khi phát sinh nghĩa vụ. Nếu điều đó đồng nghĩa với đầu tư ít hơn, bạn cũng tham gia ít hơn vào cơ hội tăng giá tài sản. Ván này chưa có mô phỏng đã xác thực cho lựa chọn đó, nên chưa thể kết luận kết quả sẽ tốt hơn.')
const goalComparison = card('goal-comparison', rules, 'Giá trị tài sản cho biết danh mục đáng giá bao nhiêu. EXE xét mục tiêu theo nguồn huy động hợp lệ: tiền mặt, gốc tiết kiệm còn hiệu lực và số thực nhận khi bán tài sản được tính, sau khi trừ nợ và nghĩa vụ. Tiền mặt có thể dùng ngay, còn tài sản phải đáp ứng quy tắc bán hoặc rút. Ví dụ giả định: hai danh mục có cùng giá trị, một bên giữ tiền mặt, bên kia giữ vốn kinh doanh chưa bán. Vốn kinh doanh chưa bán không được tính vào nguồn huy động hợp lệ.')
const latestGoldPurchase = (context: LearningContext) => context.entries.find(item => item.kind === 'buy' && item.asset === 'gold')

function finalOutcome(result: NonNullable<LearningContext['result']>) {
  const status = result.won ? 'đạt mục tiêu' : result.insolvent ? 'mất khả năng thanh toán' : 'chưa đạt mục tiêu'
  const gap = result.target - result.funds
  return 'Ván ' + status + '. Nguồn huy động hợp lệ ' + money(result.funds) + ', mốc mục tiêu ' + money(result.target)
    + (gap > 0 ? ', còn thiếu ' + money(gap) + '.' : '.')
}

export function learningCards(context: LearningContext | null): LearningCard[] {
  const verified = [...glossary, ...verifiedKnowledge, readOnly, noForecast, goldLiquidity, decisionImpact, cashHypothesis, goalComparison]
  if (!context) return [...verified, noFinalResult, noGoldHistory]
  const { cash, obligations, result, gold, entries, scenario } = context
  const cards = [...verified, card('cash', 'Trạng thái ván', 'Tiền mặt tại thời điểm hỏi là ' + money(cash)
    + '. Nghĩa vụ đã ghi nhận là ' + money(obligations) + '.')]
  const situation = SCENARIOS.find(item => item.id === scenario)
  if (situation) cards.push(card('scenario', 'Trạng thái ván', 'Bối cảnh của vòng ' + context.lap + ' là “' + situation.label + '”.'))
  if (result) {
    const outcome = finalOutcome(result)
    const completion = result.requiredRounds ? 'hoàn thành đủ ' + result.requiredRounds + ' vòng' : 'đáp ứng điều kiện hoàn thành của ván'
    cards.push(card('result', 'Kết quả chính thức', outcome + ' Tài sản ròng là ' + money(result.worth)
      + '. Để thắng, cần ' + completion + ' và đạt mốc nguồn huy động hợp lệ. Hãy theo dõi khoản có thể huy động theo luật EXE, vì tài sản ròng là chỉ số riêng.'
      + ' Kết quả cuối ván không tự cho biết quyết định nào dẫn đến kết quả này.'))
    cards.push(card('actual-result', 'Kết quả chính thức', 'Kết quả thực tế: ' + outcome))
    cards.push(card('prediction-result', 'Kết quả chính thức', outcome
      + ' Để thắng, cần ' + completion + ' và đạt mốc nguồn huy động hợp lệ.'
      + ' Ngay cả khi dự đoán đúng xu hướng của một tài sản, bạn vẫn cần theo dõi nguồn huy động hợp lệ của cả danh mục.'))
  } else cards.push(noFinalResult)
  if (gold) cards.push(card('gold-market', history, 'Mốc vàng gần nhất ghi nhận trong vòng ' + gold.lap + ' có giá từ '
    + money(gold.before) + ' đến ' + money(gold.after) + '. Một mốc riêng lẻ không cho biết toàn bộ nguyên nhân biến động.'))
  else cards.push(noGoldHistory)
  for (const item of entries) {
    const title = item.asset ? labels[item.kind] + ' (' + assets[item.asset] + ')' : labels[item.kind]
    const choice = learningChoiceLabel(item.event, item.choice)
    cards.push(card('entry-' + item.id, history, 'Vòng ' + item.lap + ', mục ' + item.id + ': ' + title
      + (item.event ? ' — ' + events.get(item.event)?.title : '')
      + (choice ? ', đã chọn “' + choice + '”' : '')
      + (item.amount === null ? '' : ', số tiền của thao tác ' + money(item.amount))
      + '. Tiền mặt trước và sau mốc này lần lượt là ' + money(item.before) + ' và ' + money(item.after)
      + '. Nghĩa vụ đã ghi nhận sau mốc là ' + money(item.obligations) + '.'))
  }
  const buyGold = latestGoldPurchase(context)
  if (buyGold?.after === 0 && buyGold.before > 0 && buyGold.before === buyGold.amount) {
    cards.push(card('gold-cash-zero', history, 'Tại lần mua vàng được ghi nhận, toàn bộ ' + money(buyGold.before)
      + ' tiền mặt đã chuyển sang vàng, nên tiền dùng ngay sau giao dịch là 0 ₫. Nghĩa vụ đã ghi nhận tại mốc đó là '
      + money(buyGold.obligations) + '.'))
  }
  return cards
}

const definitions = new Map([
  ['nhip tang truong', 'growth'], ['thi truong than trong', 'uncertain'],
  ['tin hieu phuc hoi', 'recovery'], ['thanh khoan', 'liquidity'],
])
const selectCards = (cards: readonly LearningCard[], ids: string[]) => [...new Set(ids)].flatMap(id => cards.filter(item => item.id === id))
const plainQuestion = (question: string) => foldLearning(question).replace(/["“”«»]/gu, '').replace(/\s+/gu, ' ').trim()

function glossaryId(q: string) {
  const [first, ...rest] = q.split(/[?!.…;。！？]+/u).map(clause => clause.trim()).filter(Boolean)
  if (!first || rest.some(clause => !/^(?:hay |vui long )?(?:giai thich|noi) (?:don gian|ngan gon|de hieu)(?: (?:giup|cho) (?:toi|minh|em))?$/u.test(clause))) return undefined
  const term = /^(?:(?:thuat ngu|khai niem) )?(.+?)(?: trong exe)? (?:la gi|nghia la gi)(?: vay| a)?(?:,? (?:hay |vui long )?giai thich (?:don gian|ngan gon|de hieu)(?: giup (?:toi|minh|em))?)?$/u.exec(first)?.[1]
    ?? /^(?:hay |vui long )?(?:giai thich(?: (?:don gian|ngan gon|de hieu))?(?: ve)?|dinh nghia) (.+?)(?: trong exe)?(?: (?:giup|cho) (?:toi|minh|em))?$/u.exec(first)?.[1]
  return term ? definitions.get(term) : undefined
}

function asksAboutFinalResult(q: string) {
  return /\b(?:cuoi van|cuoi cung|ket qua van)\b/u.test(q)
    && /\b(?:muc tieu|chien thang|thang|thua|huy dong|tai san rong)\b/u.test(q)
    && !/\b(?:khong hoi|khong can|neu|gia su)\b/u.test(q)
}

function answerIntents(question: string, cards: readonly LearningCard[]) {
  const clauses = question.normalize('NFC').toLowerCase()
    .split(/[?!.…;。！？,:]+|\bvà\s+(?=quyết định|lựa chọn|vì sao|tại sao)|\bva\s+(?=quyet dinh|lua chon|vi sao|tai sao)/u)
    .map(clause => ({ original: clause, text: plainQuestion(clause) }))
    .filter(({ original, text }) => text && !/\b(?:khong (?:hoi|can biet|can giai thich)|chua hoi)\b/u.test(text)
      && !/(?:^|[^\p{L}])đừng\s/u.test(original) && !/\b(?:dung (?:noi|giai thich|phan tich|doan))\b/u.test(text))
  const matches = (pattern: RegExp) => clauses.some(({ text }) => pattern.test(text))
  const prediction = clauses.some(({ text }) => {
    const personal = /\b(?:toi|minh|em) (?:khong |chua )?(?:du doan|doan)\b|\bdu doan (?:cua toi|cua minh)\b/u.test(text)
    const market = /\b(?:vang|co phieu|trai phieu|thi truong|gia)\b/u.test(text)
    return personal && (market || /\b(?:ghi nhan|luu|trong van|muc tieu)\b/u.test(text))
      || market && /\b(?:toi|minh|em) (?:khong |chua )?nghi\b/u.test(text) && /\b(?:se|tang|giam|khac)\b/u.test(text)
  })
  const gold = matches(/\bvang\b/u)
  const comparesFunds = (text: string) =>
    /\b(?:tai san|danh muc)\b/u.test(text) && /\b(?:tuong duong|cung gia tri|bang nhau|nhu nhau|ngang nhau)\b/u.test(text)
    && /\b(?:dat muc tieu|huy dong|thanh khoan)\b/u.test(text)
    && /\b(?:hai|2|moi|tung|nguoi|danh muc)\b/u.test(text)
  const outcome = clauses.some(({ text }) => asksAboutFinalResult(text) && !comparesFunds(text))
    || clauses.some(({ text }) => !/^(?:neu|gia su|gia dinh)\b/u.test(text)
      && /\b(?:van|lai|da|minh|toi) (?:bi )?thua(?: van(?: nay)?)?$|\b(?:khong thang|khong dat muc tieu)(?: van(?: nay)?)?$/u.test(text)
      && (prediction || /\b(?:van|muc tieu)\b/u.test(text) && /\b(?:vi sao|tai sao|the nao)\b/u.test(text)))
  const rank = clauses.some(({ text }) => /\b(?:quyet dinh|lua chon|giao dich) nao\b.*\b(?:anh huong|tac dong)\b.*\b(?:nhat|chu yeu)\b/u.test(text)
    && (outcome || prediction || /\b(?:nhat|chu yeu)(?: den (?:ket qua|muc tieu)(?: van)?)?$/u.test(text)))
  const cashHypothesis = clauses.some(({ text }, index) => /\b(?:neu|gia su|gia dinh)\b.*\bgiu(?: lai)?\b.*\b(?:nhieu|them) tien mat\b/u.test(text)
    && (/\b(?:ket qua|tot hon|thang|muc tieu)\b/u.test(text)
      || /\b(?:ket qua|tot hon|thang|muc tieu)\b/u.test(clauses[index + 1]?.text ?? '')))
  const comparison = clauses.some(({ text }) => comparesFunds(text))

  const riskComparison = matches(/\brui ro\b.*\bthanh khoan\b|\bthanh khoan\b.*\brui ro\b/u)
    && matches(/\brui ro\b.*\bthi truong\b|\bthi truong\b.*\brui ro\b/u)
  const diversification = clauses.some(({ text }) => /\bda dang hoa\b/u.test(text)
    && (/\b(?:danh muc|tai san|dau tu|rui ro|toi|minh|em|ich gi|la gi|luc nao cung tot|thua|thang|muc tieu)\b/u.test(text)
      || /^da dang hoa[?!]?$/u.test(text))
    && !/\b(?:he sinh thai|sinh hoc|cay trong|san pham|ngon ngu)\b/u.test(text))
  const ratesAndStocks = matches(/\blai suat\b.*\bco phieu\b|\bco phieu\b.*\blai suat\b/u)
    || matches(/\blai suat (?:tang|giam|thay doi)\b/u) && matches(/\bco phieu\b.*\b(?:tang|giam)\b/u)
  const diversificationResult = diversification && matches(/\b(?:van|lai|sao|vi sao|tai sao) (?:bi )?thua\b|\b(?:khong dat muc tieu|khong thang|ket qua cuoi van|ket qua van)\b/u)
  const personalAllocation = diversification && matches(/\b(?:toi|minh|em) (?:da )?(?:da dang hoa|chia von)\b/u)

  const ids: string[] = []
  if (riskComparison) ids.push('risk-difference', 'risk-example-exe')
  if (diversification) ids.push('diversification', 'diversification-exe')
  if (ratesAndStocks) ids.push('rates-and-stocks', 'stock-prices-exe')
  const hasResult = cards.some(item => item.id === 'result')
  if (prediction) ids.push('no-forecast')
  if (diversificationResult && !prediction) ids.push(hasResult ? 'actual-result' : 'no-final-result')
  if (outcome && (!diversificationResult || prediction) && (prediction || rank || matches(/^(?:tai sao|vi sao|giai thich|ket qua cuoi van)\b/u))) {
    if (hasResult) ids.push(prediction ? 'prediction-result' : 'result')
    else ids.push('no-final-result', ...(prediction ? [] : ['goal-rule']))
  }
  if (rank) ids.push('decision-impact')
  if (prediction && gold && !rank) ids.push('gold-market', 'no-gold-history')
  if (cashHypothesis) {
    if (!ids.some(id => ['result', 'prediction-result', 'no-final-result'].includes(id))) ids.push('actual-result', 'no-final-result')
    ids.push('cash-hypothesis')
  }
  if (comparison) ids.push('goal-comparison')
  if (diversificationResult || personalAllocation) ids.push('diversification-limit')

  if (clauses.some(({ text }) => /\b(?:vi sao|tai sao)\b/u.test(text) && /\bmua vang\b/u.test(text)
    && /\btien mat\b/u.test(text) && /\b(?:0|het)\b/u.test(text) && !/\b(?:khong|chua|neu|gia su)\b/u.test(text))) {
    if (cards.some(item => item.id === 'gold-cash-zero')) ids.push('gold-cash-zero', 'gold-liquidity')
  }
  return ids
}

export function offlineLearning(question: string, cards: readonly LearningCard[]): LearningCard[] | null {
  const q = plainQuestion(question)
  const term = glossaryId(q)
  if (term) return selectCards(cards, [term])
  if (/^(?:(?:hay |vui long )(?:mua|ban|vay|chuyen tien)\b|thuc hien giao dich|bo qua (?:luat|huong dan)|in (?:key|prompt))/u.test(q)) {
    return selectCards(cards, ['read-only'])
  }
  if (/^(?:doi chieu|tong hop|phan tich) (?:nhat ky|cac|lich su)\b/u.test(q)) return null
  const answer = selectCards(cards, answerIntents(question, cards))
  return answer.length ? answer : null
}

export function fallbackLearning(question: string, cards: readonly LearningCard[], context?: LearningContext | null) {
  const q = plainQuestion(question)
  const known = selectCards(cards, answerIntents(question, cards))
  if (known.length) return known
  if (asksAboutFinalResult(q)) return selectCards(cards, ['result', 'no-final-result'])
  if (/^(?:tom tat|cho (?:toi|minh) xem) (?:tien mat|so du)(?: hien tai| hien the nao)?[?!.]*$/u.test(q)) {
    return selectCards(cards, ['cash'])
  }
  if (/^(?:tom tat|nhac lai|cho (?:toi|minh) xem) giao dich (?:vua roi|gan nhat)[?!.]*$/u.test(q)) {
    const trade = context?.entries.find(item => ['buy', 'sell', 'deposit', 'withdraw', 'repay', 'upgrade'].includes(item.kind))
    return trade ? selectCards(cards, ['entry-' + trade.id]) : []
  }
  return []
}

export function composeLearningAnswer(cards: readonly LearningCard[]): LearningCard[] {
  const ids = new Set(cards.map(item => item.id))
  const covered = new Set<string>()
  if (ids.has('risk-difference')) covered.add('liquidity')
  if (ids.has('risk-example-exe')) {
    covered.add('gold-rule')
    covered.add('gold-liquidity')
  }
  if (ids.has('prediction-result')) covered.add('actual-result')
  if (ids.has('result') && ids.has('actual-result')) {
    covered.add(ids.has('diversification') ? 'result' : 'actual-result')
  }
  const seen = new Set<string>()
  const unique = cards.filter(item => {
    if (covered.has(item.id) || seen.has(item.text)) return false
    seen.add(item.text)
    return true
  })
  if (!unique.some(item => item.scope === 'GENERAL_FINANCE')) return unique
  const order: Record<LearningScope, number> = { GENERAL_FINANCE: 0, EXE_RULE: 1, GAME_FACT: 2, UNKNOWN: 3 }
  return unique.sort((a, b) => order[a.scope] - order[b.scope])
}

export function resolveLearningReply(question: string, cards: readonly LearningCard[], reply: LearningReply, context: LearningContext) {
  const selected = selectCards(cards, reply.ids)
  const known = fallbackLearning(question, cards, context)
  if (!selected.length) return { source: known.length ? 'offline' as const : 'fallback' as const, cards: composeLearningAnswer(known) }

  // A provider can locate relevant evidence. It cannot replace an already verified explanation.
  const hasKnowledge = known.some(item => item.scope === 'GENERAL_FINANCE')
  const combined = hasKnowledge
    ? [...known, ...selected.filter(item => item.id.startsWith('entry-'))]
    : selected
  const answer = composeLearningAnswer(combined)
  const addedEvidence = answer.some(item => !known.some(local => local.id === item.id))
  return { source: hasKnowledge && !addedEvidence ? 'offline' as const : reply.source, cards: answer }
}

export function deduplicateLearningIds(ids: string[], context: LearningContext) {
  if (!ids.includes('gold-cash-zero')) return ids
  const purchase = latestGoldPurchase(context)
  if (!purchase) return ids
  const sameCash = context.cash === purchase.after && context.obligations === purchase.obligations
  return ids.filter(id => id !== 'entry-' + purchase.id && !(id === 'cash' && sameCash))
}

export function readLearningIds(value: unknown, cards: readonly LearningCard[]): string[] | null {
  return readCardIds(value, cards, 3)
}

function readCardIds(value: unknown, cards: readonly LearningCard[], limit: number): string[] | null {
  if (!exact(value, ['ids']) || !Array.isArray(value.ids) || value.ids.length > limit
    || !value.ids.every(id => typeof id === 'string' && cards.some(item => item.id === id))
    || new Set(value.ids).size !== value.ids.length) return null
  return value.ids
}
export function readLearningReply(value: unknown, cards: readonly LearningCard[]): LearningReply | null {
  if (!exact(value, ['source', 'ids']) || (value.source !== 'offline' && value.source !== 'mock'
    && value.source !== 'gemini' && value.source !== 'fallback')) return null
  const ids = readCardIds({ ids: value.ids }, cards, value.source === 'offline' ? cards.length : 3)
  return ids && (value.source !== 'fallback' || ids.length === 0) ? { source: value.source, ids } : null
}
