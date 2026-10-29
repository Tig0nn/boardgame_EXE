import { deterministicAdvice } from '../advice.ts'
import { buildRepairFacts } from '../facts.ts'
import { createAdviceCandidate, renderStatement } from '../templates.ts'
import type { AdviceMode, CompanionRequest, CompanionSuccess, GroundedStatement, RepairOptionId } from '../types.ts'
import type { QuestionFallback, QuestionIntent, QuestionRoute } from './routing.ts'

const modes: Record<QuestionIntent, AdviceMode> = {
  rules: 'explain', cost: 'explain', compare: 'compare', liquidity: 'explain', risk: 'guide', learning: 'guide',
}
const introductions: Record<QuestionIntent, string> = {
  rules: 'Sửa tạm đổi lịch chi trả. Phân biệt khoản trả ngay và nghĩa vụ chỉ phát sinh khi hoàn tất thanh toán ban đầu.',
  cost: 'Sửa tạm không miễn phí. Đối chiếu khoản trả ban đầu, khoản hẹn trả và tổng chi phí của cả hai lựa chọn.',
  compare: 'So sánh tổng chi phí với tiền mặt giữ lại ngay. Không có lựa chọn tự động tốt nhất cho mọi nhu cầu.',
  liquidity: 'Có tài sản không có nghĩa là có đủ tiền mặt dùng ngay. Xem tiền mặt sau phần trả ban đầu của từng lựa chọn.',
  risk: 'Trả ngay yêu cầu khoản trả ban đầu cao hơn; sửa tạm có khoản đến hạn sau. Chưa biết tiền mặt ở lần quyết toán tới.',
  learning: 'Bài học là cân đối tiền mặt hiện tại với cam kết tương lai. Bạn tự quyết định và lập kế hoạch cho khoản đến hạn.',
}
const fallbacks: Record<QuestionFallback, string> = {
  'clarification-needed': 'Chưa xác định được bạn muốn hỏi điều gì. Bạn muốn tìm hiểu chi phí, thanh khoản hay rủi ro của hai lựa chọn sửa xe?',
  'missing-data': 'Chưa thể trả lời câu hỏi này vì ngữ cảnh sửa chữa chưa có dữ liệu về thu nhập, chi phí sinh hoạt hoặc chi phí huy động. Bạn có thể hỏi: “Sửa xe tốn bao nhiêu?”.',
  'hidden-or-future': 'Không thể trả lời câu hỏi về dữ liệu ẩn hoặc kết quả tương lai. Để tìm hiểu luật đã công khai, bạn có thể hỏi: “Bao giờ phải trả khoản hẹn sửa xe?”.',
  'real-world': 'Không hỗ trợ khuyến nghị đầu tư ngoài đời. Trợ giúp này chỉ dùng cho trò chơi; bạn có thể hỏi: “So sánh trả ngay và sửa tạm”.',
  'unsupported-wording': 'Chưa hỗ trợ cách hỏi này. Hiện chỉ trả lời các cách hỏi sửa chữa được hỗ trợ, như “So sánh trả ngay và sửa tạm” hoặc “Thanh khoản là gì?”.',
}
interface LabeledStatement {
  label: string
  optionId: RepairOptionId | null
  statement: GroundedStatement
}
export interface QuestionLesson {
  explanation: string
  statements: LabeledStatement[]
  reflectionQuestion: GroundedStatement | null
  limitations: CompanionSuccess['advice']['limitations']
}

export async function selectQuestionLesson(request: CompanionRequest, route: QuestionRoute): Promise<QuestionLesson> {
  // Reuse canonical financial rendering. Questions never supply plan bindings or amounts.
  const base = await deterministicAdvice({ ...request, question: undefined,
    mode: route.intent === 'unsupported' ? 'explain' : modes[route.intent] })
  const advice = base.advice
  const funding = advice.limitations.includes('funding-costs-not-included')
  // Abstention is not a completed lesson: no financial quiz, claims or supporting evidence.
  if (route.intent === 'unsupported') return { explanation: fallbacks[route.reason],
    statements: [], reflectionQuestion: null, limitations: advice.limitations }
  const reflectionQuestion = funding ? renderStatement(createAdviceCandidate({ ...request, question: undefined,
    mode: 'guide' }).reflectionQuestion, buildRepairFacts(request.context)) : advice.reflectionQuestion
  const [fullStatement, temporaryStatement] = advice.tradeoffs.map(group => group.statements[0])
  const [dueStatement, obligationsStatement] = advice.risks
  const row = (label: string, optionId: RepairOptionId | null, statement: GroundedStatement): LabeledStatement =>
    ({ label, optionId, statement })
  const summary = row('Giải thích', null, advice.summary)
  const full = row('Trả ngay', 'full', fullStatement)
  const temporary = row('Sửa tạm', 'temporary', temporaryStatement)
  const due = row('Khoản hẹn sửa tạm', 'temporary', dueStatement)
  const obligations = row('Nghĩa vụ nếu sửa tạm', 'temporary', obligationsStatement)
  const selected = {
    rules: [summary, temporary, due],
    cost: [full, temporary, due],
    compare: [summary, full, temporary, due],
    liquidity: [summary, full, temporary],
    risk: [full, temporary, due, obligations],
    learning: [summary, full, temporary, due],
  }
  return { explanation: 'Trong tình huống sửa chữa của trò chơi: ' + introductions[route.intent]
      + (funding ? ' Có lựa chọn còn thiếu tiền mặt. Chưa biết nguồn và chi phí huy động; đây không phải giao dịch đã thực hiện.' : ''),
    statements: selected[route.intent], reflectionQuestion, limitations: advice.limitations }
}
