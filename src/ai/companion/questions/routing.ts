import { invalid, plainText } from '../schema.ts'

export const QUESTION_INTENTS = ['rules', 'cost', 'compare', 'liquidity', 'risk', 'learning'] as const
export type QuestionIntent = typeof QUESTION_INTENTS[number]
export type QuestionFallback = 'clarification-needed' | 'missing-data' | 'hidden-or-future'
  | 'real-world' | 'unsupported-wording'
export type QuestionRoute = { intent: QuestionIntent } | { intent: 'unsupported'; reason: QuestionFallback }

function normalize(value: unknown): string {
  const question = plainText(400)(value).normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/[?!.]+$/u, '').replace(/\s+/gu, ' ').trim()
  if (!question) invalid()
  return question
}

// Whole utterances only. Never match a safe substring inside a second instruction.
const phrases: Record<QuestionIntent, string[]> = {
  rules: ['Sửa tạm hoạt động thế nào', 'Bao giờ phải trả khoản hẹn sửa xe',
    'Qua Xuất phát có phải trả tiền sửa tạm không', 'Nghĩa vụ sửa xe được ghi nhận khi nào'],
  cost: ['Sửa xe tốn bao nhiêu', 'Trả ngay mất bao nhiêu tiền', 'Sửa tạm trả bao nhiêu bây giờ',
    'Sửa tạm miễn phí đúng không', 'Tổng chi phí sửa xe là bao nhiêu'],
  compare: ['So sánh trả ngay và sửa tạm', 'Hai cách sửa xe khác nhau thế nào',
    'Sửa tạm hay trả ngay', 'Tôi muốn so sánh hai lựa chọn sửa xe'],
  liquidity: ['Thanh khoản là gì', 'Tại sao có tài sản vẫn thiếu tiền sửa xe',
    'Tiền mặt khác tài sản ròng thế nào', 'Sửa xe ảnh hưởng tiền mặt thế nào'],
  risk: ['Sửa tạm có rủi ro gì', 'Khoản hẹn trả có ảnh hưởng gì',
    'Trả ngay có đánh đổi gì', 'Rủi ro của hai lựa chọn sửa xe là gì'],
  learning: ['Tôi học được gì từ lựa chọn sửa xe', 'Làm sao lập kế hoạch cho khoản hẹn trả',
    'Nên cân nhắc gì khi sửa xe', 'Bài học tài chính từ sửa xe là gì'],
}
const routes = new Map(Object.entries(phrases).flatMap(([intent, values]) =>
  values.map(value => [normalize(value), intent as QuestionIntent] as const)))

export function classifyRepairQuestion(value: unknown): QuestionRoute {
  const question = normalize(value)
  const unsupported = (reason: QuestionFallback): QuestionRoute => ({ intent: 'unsupported', reason })
  // Explicit abstention priorities apply even when a known phrase appears elsewhere.
  if (/\b(seed|rng|xuc xac|tuong lai)\b/u.test(question)
    || question.includes('lan qua xuat phat toi chac')) return unsupported('hidden-or-future')
  if (/\b(ngoai doi|dau tu that|tien that)\b/u.test(question)) return unsupported('real-world')
  if (/\b(thu nhap|chi phi sinh hoat|lai vay|vay de sua xe)\b/u.test(question)) return unsupported('missing-data')
  if (['cai nao tot hon', 'khoan do la gi', 'toi nen lam gi', 'cai nay la gi'].includes(question)) {
    return unsupported('clarification-needed')
  }
  const intent = routes.get(question)
  return intent ? { intent } : unsupported('unsupported-wording')
}
