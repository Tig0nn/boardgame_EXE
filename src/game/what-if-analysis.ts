import type { RepairWhatIf, RepairOutcome } from './what-if.ts'
import { money } from './format.ts'

export type AnalysisFact = Readonly<{ label: string; value: number | string; source: string }>
export type AnalysisSection = Readonly<{ id: string; heading: string; text: string; evidence: readonly string[] }>
export type RepairAnalysis = Readonly<{
  status: 'complete' | 'limited' | 'invalid'
  facts: Readonly<Record<string, AnalysisFact>>
  sections: readonly AnalysisSection[]
}>
const validMoney = (n: number) => Number.isSafeInteger(n) && n >= 0
const label = (o: RepairOutcome) => o.choice === 'full' ? 'Sửa ngay' : 'Sửa tạm'

/** Read-only explanation of the decision horizon. No forecasts, policies, API or game actions. */
export function analyzeRepairWhatIf(c: RepairWhatIf): RepairAnalysis {
  const facts: Record<string, AnalysisFact> = {}
  const fact = (id: string, name: string, value: number | string, source: string) => {
    facts[id] = Object.freeze({ label: name, value, source })
    return id
  }
  const section = (id: string, heading: string, text: string, evidence: string[]): AnalysisSection =>
    Object.freeze({ id, heading, text, evidence: Object.freeze(evidence) })
  const validOutcome = (o: RepairOutcome) => ['full', 'temporary'].includes(o.choice)
    && ['paid', 'funding-required', 'insolvent'].includes(o.status)
    && [o.cashAfter, o.immediateDue, o.paidNow, o.fundingRemaining, o.obligationAdded,
      o.obligationOnCompletion, o.totalCommitted].every(validMoney)
    && o.cashAfter === c.cashBefore - o.paidNow
    && o.paidNow === Math.min(c.cashBefore, o.immediateDue)
    && o.fundingRemaining === o.immediateDue - o.paidNow
    && (o.status === 'paid') === (o.fundingRemaining === 0)
    && o.obligationAdded === (o.status === 'paid' ? o.obligationOnCompletion : 0)
    && o.totalCommitted === o.immediateDue + o.obligationOnCompletion
    && (o.choice !== 'full' || o.obligationOnCompletion === 0)
  const full = c.actual.choice === 'full' ? c.actual : c.alternative
  const temporary = c.actual.choice === 'temporary' ? c.actual : c.alternative
  const valid = validMoney(c.cashBefore) && validOutcome(c.actual) && validOutcome(c.alternative)
    && c.actual.choice !== c.alternative.choice
    && c.temporaryCashKept === temporary.cashAfter - full.cashAfter
    && c.temporaryExtraCost === temporary.totalCommitted - full.totalCommitted
    && temporary.immediateDue < full.immediateDue && c.temporaryExtraCost > 0
    && (!c.context || [c.context.existingObligations, c.context.livingAtStart,
      c.context.savingsPrincipal, c.context.debtPrincipal, c.context.debtInterestAtStart].every(validMoney))
  if (!valid) {
    fact('validation', 'Kiểm tra tính nhất quán', 'failed', 'DTO: số tiền, cân đối cash/payment, trạng thái và context')
    return Object.freeze({ status: 'invalid', facts: Object.freeze(facts), sections: Object.freeze([
      section('invalid', 'Giới hạn phân tích', 'Dữ liệu hai nhánh hoặc bối cảnh tài chính không nhất quán. Chưa thể đưa ra kết luận; cần tạo lại so sánh từ cùng trạng thái trước quyết định.', ['validation']),
    ]) })
  }
  fact('cash.before', 'Tiền mặt trước quyết định', c.cashBefore, 'pre-decision portfolio.cash')
  for (const [key, outcome] of [['actual', c.actual], ['alternative', c.alternative]] as const) {
    fact(`${key}.choice`, `${key}: lựa chọn`, outcome.choice, `${key}.choice ← accepted decision / other option`)
    fact(`${key}.cash`, `${key}: cash sau quyết định`, outcome.cashAfter, `${key}.cashAfter ← decide().portfolio.cash`)
    fact(`${key}.paid`, `${key}: đã trả`, outcome.paidNow, `${key}.paidNow ← decision.expensePaid`)
    fact(`${key}.funding`, `${key}: còn thiếu ngay`, outcome.fundingRemaining, `${key}.fundingRemaining ← pendingPayment.remaining`)
    fact(`${key}.obligation`, `${key}: nghĩa vụ mới đã tạo`, outcome.obligationAdded, `${key}.obligationAdded ← decision.obligationCreated`)
    fact(`${key}.conditional`, `${key}: nghĩa vụ khi trả đủ`, outcome.obligationOnCompletion, `${key}.obligationOnCompletion ← official repair option.obligation`)
    fact(`${key}.cost`, `${key}: tổng chi phí lựa chọn`, outcome.totalCommitted, `${key}.totalCommitted ← totalWorth delta (paid) / official option (unfinished)`)
  }
  fact('trade.cash', 'Cash alternative trừ actual', c.alternative.cashAfter - c.actual.cashAfter, 'alternative.cashAfter − actual.cashAfter')
  fact('trade.cost', 'Chi phí alternative trừ actual', c.alternative.totalCommitted - c.actual.totalCommitted, 'alternative.totalCommitted − actual.totalCommitted')
  fact('scope', 'Phạm vi mô phỏng', 'decision-only', 'simulateRepairWhatIf: two decide calls, no advance/roll/fundPayment')
  const a = c.actual, b = c.alternative
  let reserveShortfall = false
  let evaluation = a.status === 'paid'
    ? `${label(a)} đủ tiền mặt để trả ngay, không cần huy động vốn cho lần thanh toán này. ${a.choice === 'full'
      ? 'Bạn đổi một phần thanh khoản để chốt chi phí thấp hơn và không tạo thêm khoản sửa xe ở START.'
      : 'Bạn giữ khả năng chi ngay bằng cách hoãn một phần chi phí sang START; phần hoãn vẫn là nghĩa vụ, không phải khoản tiết kiệm.'}`
    : `${label(a)} chưa hoàn tất: cash đã dùng hết và còn thiếu ${money(a.fundingRemaining)}. Chưa thể xem chi phí lựa chọn là chi phí sau tài trợ vốn; nghĩa vụ mới chỉ được tạo khi trả đủ.`
  if (a.status === 'insolvent') evaluation += ' Engine xác nhận không còn nguồn thanh toán hợp lệ; nhánh này đã kết thúc vì mất khả năng thanh toán.'
  let change: string
  if (b.status !== 'paid') {
    change = `${label(b)} ${a.status === 'paid' ? 'chưa thể hoàn tất chỉ với cash hiện có' : 'vẫn cần huy động vốn'}: còn thiếu ${money(b.fundingRemaining)}. ${a.status === 'paid'
      ? 'Chi phí lựa chọn thấp hơn chưa đủ để coi đây là phương án khả thi ngay.'
      : 'Cả hai nhánh đều cần một quyết định tài trợ riêng; chưa so được chi phí ròng sau phí hoặc lãi.'}`
    if (b.status === 'insolvent') change += ' Engine xác nhận nhánh thay thế cũng không còn nguồn thanh toán hợp lệ.'
  } else if (a.status !== 'paid') {
    change = `${label(b)} trả được ngay trong khi lựa chọn thực tế cần tài trợ. Đổi lại, nghĩa vụ mới là ${money(b.obligationAdded)} ở START; khả năng trả ngay không đồng nghĩa tổng chi phí thấp hơn.`
  } else if (b.choice === 'temporary') {
    change = `Chọn sửa tạm giải phóng ${money(b.cashAfter - a.cashAfter)} để sử dụng ngay, nhưng chuyển ${money(b.obligationAdded)} sang START và làm tổng cam kết tăng ${money(b.totalCommitted - a.totalCommitted)}. Đây là mua thêm thanh khoản có chi phí, không phải tăng tài sản ròng.`
  } else {
    change = `Chọn sửa ngay dùng thêm ${money(a.cashAfter - b.cashAfter)} cash hôm nay để bỏ nghĩa vụ sửa xe ${money(a.obligationAdded)} ở START; tổng cam kết giảm ${money(a.totalCommitted - b.totalCommitted)}. Bạn giảm chi phí bằng cách giảm tiền có thể chi ngay.`
  }
  let risk = section('context-missing', 'C. Rủi ro và chi phí cơ hội',
    'Còn thiếu dữ liệu nghĩa vụ cũ và chi phí sinh hoạt theo luật của ván. Chỉ xác nhận được chênh lệch của sửa xe; chưa thể đánh giá cash còn lại có bao phủ các khoản đã biết hay không.', ['scope'])
  if (c.context) {
    const ctx = c.context
    fact('context.obligations', 'Nghĩa vụ cũ ở START', ctx.existingObligations, 'pre-decision obligations (aggregate, excludes new repair)')
    fact('context.living', 'Sinh hoạt theo luật tại START', ctx.livingAtStart, 'livingCostForGame(pre-decision)')
    fact('context.savings', 'Gốc tiết kiệm', ctx.savingsPrincipal, 'pre-decision portfolio.savings; not spendable cash')
    fact('context.debt', 'Gốc nợ hiện có trả tại START', ctx.debtPrincipal, 'pre-decision portfolio.debt; settlement debt step')
    fact('context.interest', 'Lãi START trên dư nợ hiện có', ctx.debtInterestAtStart, 'round(pre-decision portfolio.debt × rulesForGame().debtRate)')
    const known = ctx.existingObligations + ctx.livingAtStart + ctx.debtPrincipal + ctx.debtInterestAtStart
    const reserveA = a.cashAfter - known - a.obligationOnCompletion
    const reserveB = b.cashAfter - known - b.obligationOnCompletion
    fact('reserve.actual', 'Cash actual trừ khoản dự phòng đối chiếu', reserveA, 'actual.cashAfter − context.obligations − context.living − context.debt − context.interest − actual.conditional')
    fact('reserve.alternative', 'Cash alternative trừ khoản dự phòng đối chiếu', reserveB, 'alternative.cashAfter − context.obligations − context.living − context.debt − context.interest − alternative.conditional')
    const unpaid = a.status !== 'paid' || b.status !== 'paid'
    reserveShortfall = !unpaid && (reserveA < 0 || reserveB < 0)
    const reserveText = unpaid
      ? 'Có nhánh chưa trả đủ: đối chiếu dự phòng chỉ có điều kiện, chưa bao gồm phần thiếu ngay hay chi phí huy động vốn.'
      : reserveA < 0
        ? `Cash sau lựa chọn thực tế chưa đủ để dành riêng cho nghĩa vụ cũ, sinh hoạt và nghĩa vụ sửa xe đã biết (thiếu ${money(-reserveA)}). ${reserveB < 0 ? 'Đổi phương án cũng chưa khép được khoảng thiếu này.' : 'Phương án khác có thể khép khoảng thiếu tĩnh này.'}`
        : reserveB < 0
          ? `Lựa chọn thực tế còn đủ cash cho phép đối chiếu các khoản đã biết; phương án khác thiếu ${money(-reserveB)} dù trả được sửa xe ngay.`
          : 'Cả hai nhánh còn đủ cash để đối chiếu nghĩa vụ cũ, sinh hoạt và nghĩa vụ sửa xe đã biết; chưa có áp lực từ riêng các khoản này để biện minh cho chi phí sửa tạm cao hơn.'
    risk = section(unpaid ? 'reserve-conditional' : reserveA < 0 ? 'reserve-shortfall' : reserveB < 0 ? 'reserve-alternative-shortfall' : 'reserve-covered',
      'C. Rủi ro và chi phí cơ hội', `${reserveText}${ctx.debtPrincipal > 0 ? ' Phép đối chiếu đã gồm gốc và lãi START trên dư nợ hiện có.' : ''} Đây là đối chiếu cash hiện tại, không phải dự báo số dư ở START; chưa bù thu nhập, đáo hạn hoặc khoản chi khác.`,
      ['actual.cash', 'alternative.cash', 'actual.conditional', 'alternative.conditional', 'context.obligations', 'context.living', 'context.debt', 'context.interest', 'reserve.actual', 'reserve.alternative', 'scope'])
    if (a.status !== 'paid' && ctx.savingsPrincipal > 0) evaluation += ' Có gốc tiết kiệm nhưng chưa chọn rút; không coi số đó là cash sẵn dùng.'
  }
  const funding = a.status !== 'paid' || b.status !== 'paid'
  const lesson = funding
    ? 'Khi cash không đủ, so giá sửa xe phải đi kèm nguồn tiền và phí hoặc lãi thực sự phát sinh. Chưa mô phỏng cách rút tiết kiệm, bán tài sản hay vay nên chưa thể xếp hạng tổng chi phí sau tài trợ.'
    : reserveShortfall
      ? 'Tiền còn cầm được khác với tiền chưa gắn nghĩa vụ: cash cao hơn sau sửa tạm đi cùng khoản phải trả START lớn hơn. Khoảng thiếu dự phòng chưa bù thu nhập nên không phải kết luận sẽ mất khả năng thanh toán. Khi có khoản thu thực nhận hoặc chọn nguồn tài trợ, cần đánh giá lại.'
      : 'Chỉ nên trả thêm để giữ thanh khoản khi có nhu cầu dùng tiền đủ cụ thể để bù phần chi phí tăng. Ở đây chưa có bằng chứng giữ thêm cash tạo lợi nhuận hay tránh biến cố. Nếu cash giảm, nghĩa vụ đã biết tăng hoặc phát sinh nhu cầu chi được xác nhận, đánh giá khả năng giữ tiền có thể thay đổi.'
  return Object.freeze({ status: c.context ? 'complete' : 'limited', facts: Object.freeze(facts), sections: Object.freeze([
    section(a.status === 'paid' ? `actual-${a.choice}-affordable` : 'actual-unfunded', 'A. Đánh giá quyết định đã chọn', evaluation,
      ['cash.before', 'actual.choice', 'actual.paid', 'actual.funding', 'actual.obligation', 'actual.cost', ...(c.context ? ['context.savings'] : [])]),
    section(`alternative-${b.choice}-${b.status}`, 'B. Nếu chọn phương án khác', change,
      ['actual.cash', 'alternative.cash', 'alternative.funding', 'actual.obligation', 'alternative.obligation', 'alternative.conditional', 'trade.cash', 'trade.cost']),
    risk,
    section(funding ? 'lesson-funding' : reserveShortfall ? 'lesson-reserve' : 'lesson-liquidity', 'D. Bài học cho tình huống này', lesson,
      ['trade.cash', 'trade.cost', 'actual.funding', 'alternative.funding', 'scope', ...(reserveShortfall ? ['reserve.actual', 'reserve.alternative'] : [])]),
  ]) })
}
