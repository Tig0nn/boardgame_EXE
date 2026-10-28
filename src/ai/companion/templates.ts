import type { AdviceCandidate, CandidateStatement, CompanionRequest, GroundedStatement } from './types.ts'
import type { FactRegistry } from './facts.ts'
import { CompanionContractError } from './errors.ts'

export const TEMPLATE_IDS = [
  'repair.explain-summary.v1', 'repair.cash-sufficient-overview.v1', 'repair.funding-overview.v1',
  'repair.guide-summary.v1', 'repair.full-breakdown.v1', 'repair.temporary-breakdown.v1',
  'repair.full-funding.v1', 'repair.temporary-funding.v1', 'repair.deferred-obligation-risk.v1',
  'repair.existing-obligations.v1', 'repair.reflection-liquidity.v1', 'repair.reflection-explain.v1',
  'repair.reflection-guide.v1', 'repair.scope-boundary.v1',
] as const
const statement = (name: string, bindings: Record<string, string> = {}): CandidateStatement => ({ templateId: `repair.${name}.v1`, bindings })

/** Closed P2a teaching plans: a candidate cannot omit risks, reorder roles or choose a winner. */
export function createAdviceCandidate(request: CompanionRequest): AdviceCandidate {
  const funding = request.context.options.some(option => option.execution === 'funding-required')
  const summary = request.question ? statement('scope-boundary') : request.mode === 'explain' ? statement('explain-summary')
    : request.mode === 'guide' ? statement('guide-summary') : funding ? statement('funding-overview')
      : statement('cash-sufficient-overview', { extraCost: 'comparison.extraCost', retainedCash: 'comparison.retainedCash' })
  return {
    summary,
    tradeoffs: request.context.options.map(option => {
      const id = option.optionId
      const bindings = { now: `${id}.now`, after: `${id}.cashAfter`, later: `${id}.later`, total: `${id}.total` }
      return { optionId: id, statements: [option.execution === 'funding-required'
        ? statement(`${id}-funding`, { ...bindings, shortfall: `${id}.shortfall` })
        : statement(`${id}-breakdown`, id === 'temporary' ? { ...bindings, due: 'rule.obligationDue' } : bindings)] }
    }),
    risks: [statement('deferred-obligation-risk', { later: 'temporary.later', due: 'rule.obligationDue' }),
      statement('existing-obligations', { before: 'ctx.obligations', after: 'temporary.obligationsAfter' })],
    reflectionQuestion: statement(request.mode === 'explain' ? 'reflection-explain' : request.mode === 'guide'
      ? 'reflection-guide' : 'reflection-liquidity', { concept: 'concept.liquidity' }),
  }
}

export function renderStatement(statement: CandidateStatement, facts: FactRegistry): GroundedStatement {
  const b = statement.bindings
  const money = (role: string) => {
    const fact = facts[b[role]]
    if (!fact || fact.kind !== 'money' || typeof fact.value !== 'number' || !Number.isSafeInteger(fact.value)) {
      throw new CompanionContractError('INVALID_RESPONSE')
    }
    return `${fact.value.toLocaleString('vi-VN')} đ`
  }
  let text: string
  switch (statement.templateId) {
    case 'repair.explain-summary.v1':
      text = 'Thanh khoản là tiền mặt có thể dùng ngay, khác tổng tài sản ròng. Trả sau thay đổi lịch chi trả; nghĩa vụ chỉ ghi nhận khi thanh toán ban đầu hoàn tất.'; break
    case 'repair.cash-sufficient-overview.v1':
      text = `Sửa tạm giữ thêm ${money('retainedCash')} tiền mặt ngay và có tổng chi phí cao hơn ${money('extraCost')} so với trả ngay.`; break
    case 'repair.funding-overview.v1':
      text = 'Có lựa chọn cần thêm nguồn thanh toán. Thiếu tiền mặt không tự cấm lựa chọn; việc hoàn tất còn phụ thuộc nguồn funding hợp lệ.'; break
    case 'repair.guide-summary.v1':
      text = 'Hãy cân nhắc nhu cầu tiền mặt hiện tại và khoản cam kết tại Xuất phát. Mỗi lựa chọn có đánh đổi riêng; bạn tự quyết định.'; break
    case 'repair.full-breakdown.v1':
      text = `Trả ngay ${money('now')}; tiền mặt còn ${money('after')}, nghĩa vụ sửa xe mới ${money('later')}, tổng chi phí ${money('total')}.`; break
    case 'repair.temporary-breakdown.v1':
      text = `Sửa tạm trả ${money('now')} ngay; tiền mặt còn ${money('after')}, hẹn ${money('later')} tại lần quyết toán qua Xuất phát kế tiếp; tổng chi phí ${money('total')}.`; break
    case 'repair.full-funding.v1':
    case 'repair.temporary-funding.v1':
      text = `Cần trả ${money('now')} ban đầu, tiền mặt còn ${money('after')} sau phần trả ngay và còn thiếu ${money('shortfall')}. Chỉ nếu hoàn tất thanh toán mới ghi nhận nghĩa vụ sửa xe ${money('later')}; tổng chi cam kết ${money('total')}, chưa gồm chi phí huy động.`; break
    case 'repair.deferred-obligation-risk.v1':
      text = `Khoản hẹn ${money('later')} chỉ ghi nhận sau khi hoàn tất thanh toán ban đầu và đến hạn tại lần quyết toán qua Xuất phát kế tiếp. Chưa biết tiền mặt lúc đó có đủ hay không.`; break
    case 'repair.existing-obligations.v1':
      text = `Nghĩa vụ hiện có ${money('before')}; tổng nghĩa vụ sẽ là ${money('after')} nếu hoàn tất lựa chọn sửa tạm. Đây không phải tiền mặt đã chi ngay.`; break
    case 'repair.reflection-explain.v1':
      text = 'Bạn phân biệt tổng chi phí, tiền mặt còn lại và nghĩa vụ hẹn trả trong tình huống này như thế nào?'; break
    case 'repair.reflection-guide.v1':
      text = 'Bạn cần giữ tiền mặt cho việc gì trước lần qua Xuất phát, và sẽ chuẩn bị cho khoản hẹn trả ra sao?'; break
    case 'repair.reflection-liquidity.v1':
      text = 'Bạn muốn giữ thêm tiền mặt lúc này để làm gì, và sẽ chuẩn bị cho khoản hẹn trả ra sao?'; break
    case 'repair.scope-boundary.v1':
      text = 'Trợ giúp hiện chỉ giải thích tình huống sửa chữa đã xuất hiện. Không truy xuất dữ liệu ẩn hay dự đoán diễn biến tương lai; hãy đối chiếu các lựa chọn bên dưới.'; break
    default: throw new CompanionContractError('INVALID_RESPONSE')
  }
  const evidenceRefs = [...new Set(Object.values(b))].sort()
  if (evidenceRefs.some(id => !Object.hasOwn(facts, id))) throw new CompanionContractError('INVALID_RESPONSE')
  return { templateId: statement.templateId, bindings: { ...b }, text, evidenceRefs }
}
