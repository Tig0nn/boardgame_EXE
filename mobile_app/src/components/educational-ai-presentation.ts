import type { CuratedQuestion } from '../game/curated-catalog.ts'
import type { SemanticResponse } from '../../../src/ai/companion/semantic/types.ts'
import type { GameplayFact } from '../../../src/ai/companion/universal/types.ts'
import { factValue, subjectLabel, FACTS } from '../../../src/ai/companion/universal/facts.ts'
import { draftLineLabels } from '../../../src/ai/companion/draft/answer.ts'
import type { AnswerDetail } from './ai-answer-presentation.ts'

export interface EducationalSource { kind: 'fact' | 'line' | 'entry'; code: string; subject?: string; value: number }
export interface EducationalAnswer {
  lead: string; paragraphs: string[]; details: AnswerDetail[]
  sources: EducationalSource[]; rules: string[]; missing: boolean
}
const COURSE_NAMES: Record<string, string> = { basic: 'Khóa cơ bản', advanced: 'Khóa nâng cao', upgrade: 'Khóa học' }
// New catalog IDs require an explicit content review instead of inheriting a category's answer.
const REVIEWED_IDS = new Set([
  'start-summary', 'start-actions', 'start-forecast', 'bank-rules', 'bank-risk', 'bank-compare', 'bank-maturity', 'bank-draft-cash',
  'stocks-rules', 'stocks-price', 'stocks-risk', 'stocks-sale', 'stocks-draft-cash', 'bonds-rules', 'bonds-coupon', 'bonds-risk', 'bonds-compare',
  'gold-rules', 'gold-price', 'gold-risk', 'gold-sale', 'gold-draft-cash', 'business-rules', 'business-risk', 'business-cash',
  'course-rules', 'course-compare', 'course-risk', 'course-cash', 'personal-rules', 'personal-compare', 'personal-risk', 'personal-cost',
  'macro-rules', 'macro-compare', 'macro-risk', 'finance-cash', 'finance-obligations', 'finance-income',
])
const LABELS: Record<string, string> = {
  cash: 'Tiền mặt hiện có', debt: 'Nợ gốc hiện có', obligations: 'Nghĩa vụ đã cam kết', salary: 'Thu nhập mỗi lần qua Xuất phát', living: 'Sinh hoạt mỗi lần qua Xuất phát',
  price: 'Giá đang công bố', holding: 'Giá trị đang sở hữu trước phí', rate: 'Lãi suất mỗi kỳ', principal: 'Tiền gốc đang gửi', interest: 'Lãi nếu giữ đủ kỳ hạn', maturity: 'Vòng đáo hạn theo lịch', lost: 'Lãi chưa nhận sẽ mất nếu rút sớm',
  gross: 'Giá trị bán trước phí', fee: 'Phí bán', spread: 'Chênh lệch mua–bán', net: 'Tiền dự kiến nhận sau phí',
  coupon: 'Lãi theo hợp đồng, chưa phải tiền đã nhận', creditState: 'Tình trạng trả nợ hiện tại', outstanding: 'Gốc/lãi đang chậm trả', loss: 'Gốc/lãi đã ghi nhận mất',
  businessIncome: 'Thu nhập quán theo trạng thái hiện tại', capital: 'Vốn đang nằm trong quán', recovery: 'Giá trị bán quán theo báo giá', purchaseCost: 'Vốn mua quán', upgradeCost: 'Chi phí nâng cấp quán', incremental: 'Mức tăng thu nhập theo thị hiếu hiện tại',
  owned: 'Trạng thái khóa học', courseCost: 'Học phí niêm yết theo khóa', courseBoost: 'Tăng thu nhập từ lần qua Xuất phát tiếp theo',
  immediate: 'Trả ngay nếu chọn phương án', future: 'Hẹn trả ở Xuất phát sau khi hoàn tất khoản đầu', total: 'Tổng theo phương án, chưa tính huy động vốn', after: 'Tiền mặt sau khoản trả ngay nếu đủ tiền', shortfall: 'Tiền còn thiếu cho khoản trả ngay',
  received: 'Thu nhập đã ghi nhận tại lần Xuất phát này', debtPaid: 'Nợ gốc đã trả tại lần Xuất phát này', paymentTotal: 'Khoản bắt buộc phải thanh toán', remaining: 'Khoản bắt buộc còn thiếu',
  change: 'Biến động giá đã xảy ra', beforePrice: 'Giá trước sự kiện đã công bố',
}
// Exact evidence gates, not text replacements. Wording is authored only for these approved claims.
const RULE_TOKENS: Record<string, readonly string[]> = {
  summary: ['không phải dự báo'], rebalancing: ['không mua mới tài sản tại đây'], forecast: ['không đảm bảo giá tiếp theo'],
  bank: ['Lãi chỉ nhận khi đáo hạn', 'Rút sớm chỉ được dùng khi thiếu tiền bắt buộc'],
  stocks: ['Giá cổ phiếu trong game có thể giảm', 'bán mới nhận tiền sau phí'],
  bonds: ['không phải gốc hoặc lợi nhuận được bảo đảm', 'Chậm trả', 'mất gốc hoặc coupon'],
  gold: ['không tạo lương hay coupon', 'ngay cả khi giá chưa đổi'],
  business: ['không bảo đảm hòa vốn', 'Nâng cấp chỉ mở từ lượt sau khi mua', 'Không được bán quán làm nguồn huy động bắt buộc'],
  course: ['Học phí trả bằng tiền mặt, không hoàn lại', 'Khóa đã sở hữu không mua lại', 'mỗi lần ghé mua tối đa một khóa', 'Tăng lương từ START kế tiếp'],
  personal: ['Chi phí ngay và nghĩa vụ tại START là hai khoản khác nhau', 'phí bán, lãi vay hoặc lãi tiết kiệm mất chưa nằm'],
  macro: ['không áp lại khi hỏi AI', 'không dự báo được giá tương lai'],
  'deposit-selection': ['Tiền gốc rời tiền mặt', 'rút sớm mất lãi chưa nhận'],
  'buy-selection': ['chưa thực hiện', 'mua tài sản không bảo đảm thu hồi vốn hoặc có lãi'],
  'sell-selection': ['chưa thực hiện', 'Tiền thực nhận đã trừ chênh lệch và phí'],
}
export function educationalMissing(question: CuratedQuestion, reason = 'facts-missing'): EducationalAnswer {
  let lead: string
  if (reason.includes('policy')) lead = 'Không thể bỏ luật hoặc tiết lộ thông tin riêng của trò chơi.'
  else if (reason.includes('future')) lead = 'Không thể biết giá hay sự kiện chưa xảy ra.'
  else if (reason.includes('outside')) lead = 'Chỉ giải thích tình huống trong trò chơi, không tư vấn đầu tư thật.'
  else if (question.id === 'course-compare') lead = 'Chưa đủ hai lựa chọn hợp lệ: khóa cơ bản và khóa nâng cao.'
  else if (question.id === 'personal-compare') lead = 'Cần cả hai lựa chọn trả ngay và trả cuối vòng trong cùng sự kiện để so sánh.'
  else if (question.id === 'bonds-compare') lead = 'Cần đủ dữ kiện lãi hợp đồng và tình trạng trả nợ của cả An Tâm và Bứt Phá.'
  else if (question.id === 'macro-compare') lead = 'Cần ít nhất hai tài sản có giá trước, giá sau và biến động đã công bố trong cùng sự kiện.'
  else if (question.id === 'bank-compare') lead = 'Cần lãi suất đã công bố của các kỳ hạn đang so sánh.'
  else if (question.requiredDraft?.operation === 'sell') lead = 'Cần chọn Bán, tài sản đang sở hữu và giá trị bán hợp lệ trước khi nêu tiền nhận.'
  else if (question.requiredDraft?.form === 'bank') lead = 'Cần nhập số tiền và kỳ hạn cho khoản gửi hợp lệ trước khi giải thích số dư.'
  else if (question.requiredDraft) lead = 'Cần chọn tài sản và nhập số tiền mua hợp lệ trước khi nêu số dư dự kiến.'
  else if (question.id === 'bank-maturity') lead = 'Chưa có khoản gửi đang hoạt động với lịch đáo hạn hợp lệ để giải thích.'
  else if (question.id.endsWith('-price')) lead = 'Chưa có giá đang được công bố cho tài sản này.'
  else if (question.categoryId === 'course') lead = 'Chưa đủ thông tin về trạng thái khóa học, học phí và quy tắc thu nhập để giải thích chính xác.'
  else if (question.categoryId === 'macro') lead = 'Cần bản ghi của sự kiện kinh tế đã xảy ra, không dùng giá hay sự kiện tương lai.'
  else if (question.categoryId === 'finance') lead = 'Chưa có số liệu tài chính hợp lệ của ván đang chơi để trả lời câu này.'
  else if (question.categoryId === 'bank') lead = 'Cần dữ kiện lãi suất, kỳ hạn và khoản gửi phù hợp ở ô Ngân hàng để giải thích câu này.'
  else if (question.categoryId === 'stocks') lead = 'Cần giá đã công bố và trạng thái tài sản ở ô Cổ phiếu; không tạo báo giá từ một ô khác.'
  else if (question.categoryId === 'gold') lead = 'Cần giá vàng đã công bố và trạng thái sở hữu phù hợp ở ô Vàng để giải thích câu này.'
  else if (question.categoryId === 'bonds') lead = 'Cần dữ kiện lãi hợp đồng và tình trạng tín dụng của trái phiếu đang được công bố.'
  else if (question.categoryId === 'business') lead = 'Cần dữ kiện vốn, thu nhập và quyền kinh doanh hiện tại ở ô Kinh doanh.'
  else if (question.categoryId === 'personal') lead = 'Cần các phương án trả ngay và nghĩa vụ trả sau của đúng sự kiện cá nhân đang mở.'
  else if (question.categoryId === 'start') lead = 'Cần dữ kiện của đúng bước Xuất phát đang hỏi: bản tin, tổng kết hoặc quản lý tài sản.'
  else lead = 'Chưa đủ dữ kiện của đúng tình huống đang hỏi để giải thích chính xác.'
  return { lead, paragraphs: ['Hãy kiểm tra lựa chọn và dữ kiện đang có rồi hỏi lại; chưa có giao dịch nào được thực hiện.'], details: [], sources: [], rules: [], missing: true }
}

/** Trusted input is the already validated P5 response. This module has no engine/state/provider access. */
export function presentEducationalAnswer(response: SemanticResponse, question: CuratedQuestion): EducationalAnswer {
  const p = response.gameplay, d = response.draft
  if (!REVIEWED_IDS.has(question.id)) return educationalMissing(question, 'content-unreviewed')
  if (response.status !== 'answered' || !(p?.status === 'answered' || d?.status === 'answered')) return educationalMissing(question, response.route.reason)
  const sources: EducationalSource[] = [], rules: string[] = []
  let absent = false
  const facts = p?.facts ?? [], explanation = p?.explanation ?? d?.explanation ?? ''
  function rule(key: string) {
    if (!RULE_TOKENS[key]?.every(token => explanation.includes(token))) absent = true
    else rules.push(`canonical-explanation:${key}`)
  }
  function readFact(f: GameplayFact | undefined) {
    if (!f) { absent = true; return 'chưa có số liệu' }
    sources.push({ kind: 'fact', ...f }); return factValue(f)
  }
  const find = (code: string, subject?: string) => facts.find(f => f.code === code && (subject === undefined || f.subject === subject))
  const value = (code: string, subject?: string) => readFact(find(code, subject))
  function line(code: string) {
    const found = d?.lines.find(l => l.code === code)
    if (!found) { absent = true; return 'chưa có số liệu' }
    sources.push({ kind: 'line', ...found }); return `${found.value.toLocaleString('vi-VN')} đ`
  }
  let lead: string, paragraphs: string[]
  const detailCodesDefault: readonly string[] = question.displayFacts
  let detailCodes = detailCodesDefault
  let detailSubjects: Set<string> | null = null
  const id = question.id
  if (question.scope === 'draft') {
    if (!d) return educationalMissing(question)
    if (question.requiredDraft?.operation === 'sell') {
      rule('sell-selection')
      lead = `Bạn dự kiến nhận ${line('net')} sau khi bán phần giá trị đang chọn.`
      paragraphs = [`Báo giá này đã trừ chênh lệch mua–bán ${line('spread')} và phí bán ${line('fee')}, không phải toàn bộ giá trị tài sản biến thành tiền mặt.`, 'Đây mới là phương án đang nhập, chưa bán thật; giá và tiền nhận có thể thay đổi khi dữ kiện thay đổi.']
    } else {
      rule(question.categoryId === 'bank' ? 'deposit-selection' : 'buy-selection')
      lead = `Theo phương án hiện tại, tiền mặt dự kiến còn ${line('cashAfter')}.`
      paragraphs = [`Khoản ${line('payNow')} sẽ rời tiền mặt khi bạn xác nhận; hiện chưa ${question.categoryId === 'bank' ? 'gửi tiền' : 'mua tài sản'}.`, question.categoryId === 'bank' ? 'Tiền gốc chuyển thành khoản gửi; chỉ giữ đủ kỳ hạn mới nhận lãi, còn rút sớm mất lãi chưa nhận.' : 'Bạn đổi tiền dùng ngay lấy tài sản có giá thay đổi; mua không bảo đảm thu hồi vốn hay có lãi.']
    }
  } else {
    if (!p) return educationalMissing(question)
    if (question.categoryId === 'finance') {
      rules.push('validated-fact-definitions:cash,obligations,salary,living')
      if (id === 'finance-cash') {
        lead = `Bạn hiện có ${value('cash')} tiền mặt dùng được ngay.`
        paragraphs = ['Đây là tiền sẵn có trong ván đang chơi, khác với giá trị tài sản hoặc khoản thu nhập sẽ nhận.', 'Một khoản mua hay thanh toán mới có thể làm số này thay đổi; chưa có giao dịch nào được thực hiện khi hỏi AI.']
      } else if (id === 'finance-obligations') {
        const obligations = find('obligations'); value('obligations')
        lead = obligations?.value === 0 ? 'Hiện chưa có nghĩa vụ cuối vòng đã cam kết trong dữ kiện này.' : `Bạn đang có ${value('obligations')} nghĩa vụ đã cam kết.`
        paragraphs = ['Đó là khoản phải thu xếp thanh toán theo lịch, không phải bằng chứng tiền đã được trả.', find('remaining') ? `Khoản bắt buộc đang còn thiếu là ${value('remaining')}; số thiếu này được theo dõi riêng với nghĩa vụ cuối vòng.` : 'Tiền mặt hiện có và nghĩa vụ phải trả là hai số khác nhau; không suy ra số dư sau vòng từ riêng khoản này.']
      } else {
        lead = `Thu nhập định kỳ hiện tại là ${value('salary')} mỗi lần qua Xuất phát; sinh hoạt định kỳ là ${value('living')}.`
        paragraphs = ['Đây là các khoản được xử lý theo chu kỳ của trò chơi, không phải tiền mặt được cộng ngay khi hỏi.', 'Các khoản nợ và nghĩa vụ khác còn được xử lý riêng, nên đây chưa phải số dư sau vòng.']
      }
    } else if (question.categoryId === 'course') {
      rule('course')
      const owned = facts.filter(f => f.code === 'owned'), available = owned.filter(f => f.value === 0), completed = owned.filter(f => f.value === 1)
      if (!owned.length || owned.some(f => !COURSE_NAMES[f.subject])) absent = true
      owned.forEach(readFact)
      const status = [completed.length ? `${completed.map(f => COURSE_NAMES[f.subject].toLocaleLowerCase('vi')).join(' và ')} đã hoàn thành, không trả học phí lần nữa` : '', available.length ? `${available.map(f => COURSE_NAMES[f.subject].toLocaleLowerCase('vi')).join(' và ')} chưa học` : 'không còn khóa chưa học trong dữ kiện này'].filter(Boolean).join('; ')
      const offers = available.map(f => `${COURSE_NAMES[f.subject]} cần ${value('courseCost', f.subject)}, tăng thu nhập ${value('courseBoost', f.subject)}`).join('; ')
      detailCodes = ['owned', 'courseCost', 'courseBoost']
      if (id === 'course-cash') {
        lead = 'Học phí được trừ ngay khỏi tiền mặt khi bạn mua một khóa chưa học.'
        paragraphs = [`Bạn hiện có ${value('cash')}; ${status}.`, available.length ? `${offers} mỗi lần qua Xuất phát từ lần tiếp theo.` : 'Bạn đã hoàn thành các khóa đang có, nên không có học phí mua lại các khóa này.', 'Mỗi lần ghé chỉ mua tối đa một khóa nếu đủ quyền và tiền; bạn đổi tiền dùng ngay lấy thu nhập về sau, học phí không hoàn lại.']
      } else if (id === 'course-compare') {
        if (!['course-basic', 'course-advanced'].every(a => p.actions.includes(a)) || !['basic', 'advanced'].every(s => find('owned', s)?.value === 0 && find('courseCost', s) && find('courseBoost', s))) return educationalMissing(question)
        lead = 'Hai khóa khác nhau ở số tiền học ngay và mức tăng thu nhập về sau.'
        paragraphs = available.map(f => `${COURSE_NAMES[f.subject]}: học phí ${value('courseCost', f.subject)}, tăng thu nhập ${value('courseBoost', f.subject)} mỗi lần qua Xuất phát từ lần kế tiếp.`)
        paragraphs.push('Mỗi lần ghé chỉ mua tối đa một khóa; học phí không hoàn lại và thu nhập về sau chưa phải tiền đã nhận hay lợi nhuận được bảo đảm.')
      } else if (id === 'course-risk') {
        lead = 'Học phí không được hoàn lại và không phải tài sản có thể bán lấy tiền.'
        paragraphs = [`Trong ván này, ${status}.`, 'Mỗi lần ghé chỉ mua tối đa một khóa; mức tăng thu nhập chỉ bắt đầu từ lần qua Xuất phát tiếp theo, không bù ngay tiền đã chi.']
      } else {
        lead = 'Bạn trả học phí một lần cho khóa chưa học để tăng thu nhập từ những lần qua Xuất phát sau đó.'
        paragraphs = owned.map(f => f.value === 1 ? `${COURSE_NAMES[f.subject]}: đã hoàn thành, không đóng học phí lần nữa.` : `${COURSE_NAMES[f.subject]}: học phí ${value('courseCost', f.subject)}, tăng thu nhập ${value('courseBoost', f.subject)} mỗi lần qua Xuất phát từ lần kế tiếp.`)
        paragraphs.push('Mỗi lần ghé chỉ mua tối đa một khóa nếu đủ quyền và tiền; học phí không hoàn lại, thu nhập về sau chưa phải tiền đã nhận.')
      }
    } else if (question.categoryId === 'bank') {
      rule('bank')
      if (id === 'bank-rules') {
        lead = 'Gửi tiết kiệm chuyển tiền mặt thành một khoản gửi có kỳ hạn riêng.'
        paragraphs = ['Tiền đang gửi không còn sẵn để chi ngay; chỉ giữ đủ kỳ hạn mới nhận lãi và khoản gửi không tự tái tục.', 'Rút sớm chỉ dùng khi thiếu tiền cho khoản bắt buộc, phải rút cả khoản và mất lãi chưa nhận.']
      } else if (id === 'bank-risk') {
        lead = 'Rút tiết kiệm sớm làm mất lãi chưa nhận của cả khoản rút.'
        paragraphs = ['Trong game, chỉ được rút sớm để giải quyết khoản bắt buộc thiếu tiền và phải rút toàn khoản.', 'Giữ tiền có thể dùng ngay và giữ tiền tới đáo hạn là hai nhu cầu khác nhau; lịch và lãi của từng khoản nằm ở dữ kiện bên dưới.']
      } else if (id === 'bank-compare') {
        if (!['term-1', 'term-2', 'term-3'].every(s => find('rate', s))) return educationalMissing(question)
        lead = 'Kỳ hạn dài có lãi suất cao hơn, đổi lại tiền bị giữ lâu hơn.'
        paragraphs = [`Lãi suất đang công bố: ${['term-1', 'term-2', 'term-3'].map(s => `${s.slice(5)} kỳ là ${value('rate', s)}`).join('; ')} mỗi kỳ.`, 'Mỗi kỳ là một lần qua Xuất phát; chỉ giữ đủ kỳ hạn mới nhận lãi, còn rút sớm mất lãi chưa nhận.']
      } else {
        const maturity = find('maturity')
        if (!maturity) return educationalMissing(question)
        lead = `${subjectLabel(maturity.subject)} có lịch đáo hạn ở lần qua Xuất phát của vòng ${readFact(maturity)}.`
        paragraphs = ['Khi giữ khoản gửi đến đủ kỳ hạn, bạn mới nhận lại gốc và lãi theo quy tắc của game.', 'Nếu rút sớm để giải quyết khoản bắt buộc, phải rút toàn khoản và mất lãi chưa nhận; các khoản khác có thể có lịch riêng.']
      }
    } else if (question.categoryId === 'stocks' || question.categoryId === 'gold') {
      const gold = question.categoryId === 'gold', asset = gold ? 'vàng' : 'cổ phiếu'; rule(question.categoryId)
      if (id.endsWith('-price')) {
        const price = find('price')
        if (!price) return educationalMissing(question)
        lead = gold ? `Giá vàng đang công bố là ${readFact(price)}.` : `Giá được công bố theo từng mã, chẳng hạn ${subjectLabel(price.subject)} đang ở ${readFact(price)}.`
        paragraphs = ['Đây là giá tham chiếu hiện tại, khác với số tiền thực nhận sau khi bán và trừ chi phí.', 'Giá có thể thay đổi; các con số này không phải tín hiệu mua bán hay bảo đảm lợi nhuận.']
        if (!gold) paragraphs[0] = 'Mở “Xem thêm dữ kiện” để xem giá đã công bố của các mã khác; đây là giá tham chiếu, chưa trừ chi phí bán.'
      } else if (id.endsWith('-risk')) {
        lead = gold ? 'Vàng có thể giảm giá; ngay cả khi giá chưa đổi, bán lại vẫn có thể mất tiền vì chênh lệch mua–bán và phí.' : 'Cổ phiếu có thể giảm giá; khi bán, bạn còn chịu phí giao dịch.'
        paragraphs = ['Giá trị đang sở hữu chưa phải tiền mặt dùng được ngay, và chưa bán thì chưa nhận tiền.', 'Không biết giá tương lai; chỉ khi có tài sản và báo giá hợp lệ mới nêu được số tiền bán cụ thể.']
      } else {
        const holding = find('holding', gold ? 'gold' : 'stocks')
        lead = `Mua ${asset} là đổi tiền mặt lấy tài sản có giá thay đổi.`
        paragraphs = [holding ? holding.value === 0 ? `Bạn chưa sở hữu ${asset} trong dữ kiện hiện tại.` : `Giá trị ${asset} đang sở hữu là ${readFact(holding)}, chưa trừ chi phí bán.` : 'Tiền bán chỉ được xác định khi có tài sản và báo giá hợp lệ.', gold ? 'Vàng không tạo lương hay lãi định kỳ; tiền nhận khi bán còn trừ chênh lệch mua–bán và phí.' : 'Bán mới nhận tiền sau phí; giá có thể giảm nên mua không bảo đảm thu hồi vốn.']
        if (holding?.value === 0) readFact(holding)
      }
    } else if (question.categoryId === 'bonds') {
      rule('bonds')
      const coupons = facts.filter(f => f.code === 'coupon')
      const rates = () => coupons.map(f => `${subjectLabel(f.subject)} ${readFact(f)}`).join('; ')
      if (id === 'bonds-compare' && !['an-tam', 'but-pha'].every(s => find('coupon', s) && find('creditState', s))) return educationalMissing(question)
      if (id === 'bonds-risk') {
        lead = 'Khi trái phiếu chậm trả, khoản gốc hoặc lãi đến hạn chưa vào tiền mặt của bạn.'
        paragraphs = ['Game theo dõi khoản còn phải thu; tùy tình trạng tín dụng, khoản này có thể tiếp tục chậm trả hoặc bị ghi nhận mất gốc, mất lãi.', 'Hợp đồng không bảo đảm thu đủ tiền; chỉ lô có báo giá bán hợp lệ mới bán được, một số trạng thái không thể bán.']
      } else if (id === 'bonds-compare') {
        lead = `${subjectLabel('an-tam')} có lãi hợp đồng ${value('coupon', 'an-tam')}, hiện ${value('creditState', 'an-tam').toLocaleLowerCase('vi')}.`
        paragraphs = [`${subjectLabel('but-pha')} có lãi hợp đồng ${value('coupon', 'but-pha')}, hiện ${value('creditState', 'but-pha').toLocaleLowerCase('vi')}.`, 'Lãi cao hơn không bảo đảm an toàn hơn: mỗi bên vẫn có thể chậm trả hoặc mất gốc, mất lãi; cam kết khác với tiền thực nhận.']
      } else if (id === 'bonds-coupon') {
        lead = 'Coupon là tiền lãi trái phiếu ghi trong hợp đồng, chưa phải tiền bạn đã nhận.'
        paragraphs = [coupons.length ? `Lãi hợp đồng đang công bố: ${rates()}.` : 'Chưa có mức lãi hợp đồng phù hợp để nêu con số.', 'Tổ chức phát hành có thể chậm trả hoặc mất gốc, mất lãi; hợp đồng không bảo đảm số tiền thực nhận.']
      } else {
        lead = 'Mua trái phiếu là nhận quyền được trả gốc và lãi theo hợp đồng của tổ chức phát hành.'
        paragraphs = ['Tổ chức phát hành có thể chậm trả hoặc mất gốc, mất lãi; quyền nhận tiền không bảo đảm tiền đã về ví.', 'Chỉ lô có báo giá hợp lệ mới bán được; mức lãi và tình trạng từng bên nằm trong “Xem thêm dữ kiện”.']
      }
    } else if (question.categoryId === 'business') {
      rule('business')
      const capital = find('capital'); value('capital')
      const owned = capital !== undefined && capital.value > 0
      lead = id === 'business-risk' ? 'Vốn có thể bị giữ trong quán; nâng cấp không bảo đảm hòa vốn trước khi hành trình kết thúc.' : id === 'business-cash' ? `Vốn mua quán được công bố là ${value('purchaseCost')}, trả bằng tiền mặt khi mua.` : 'Bạn bỏ vốn mua quán để nhận thu nhập khi qua Xuất phát theo trạng thái kinh doanh hiện tại.'
      if (id === 'business-cash') paragraphs = [`Bạn hiện có ${value('cash')}; chưa có số dư sau mua đã được xác nhận trong câu trả lời này.`, 'Tiền bỏ vào quán không còn sẵn để chi; nâng cấp chỉ mở từ lần ghé sau khi mua và theo quyền hiện tại.', 'Thị hiếu vòng sau chưa biết, không bảo đảm hòa vốn; quán không dùng để bán huy động khoản bắt buộc.']
      else if (id === 'business-risk') paragraphs = ['Thu nhập phụ thuộc thị hiếu chưa biết của vòng sau, nên có thể không thu hồi đủ vốn đã bỏ ra.', 'Nâng cấp chỉ từ lần ghé sau khi mua và theo quyền hiện tại; quán không được bán để huy động khoản bắt buộc.']
      else paragraphs = [owned ? `Bạn đang có quán; nâng cấp chỉ mở từ lần ghé sau khi mua và theo quyền hiện tại.` : 'Bạn chưa có quán; nâng cấp chỉ mở từ lần ghé sau khi mua và theo quyền hiện tại.', 'Thu nhập phụ thuộc thị hiếu, không bảo đảm hòa vốn; quán không được bán để huy động khoản bắt buộc.']
    } else if (question.categoryId === 'personal') {
      rule('personal')
      if (!FACTS.future[0].includes('nếu hoàn tất thanh toán ban đầu')) absent = true
      else rules.push('validated-fact-definition:future-condition')
      const deferred = facts.find(f => f.code === 'future' && f.value > 0)
      if (id === 'personal-compare') {
        if (!['pay', 'defer'].every(s => p.actions.includes(s) && find('immediate', s) && find('future', s))) return educationalMissing(question)
        lead = `Trả ngay: thanh toán ${value('immediate', 'pay')} ở thời điểm này.`
        const upfront = find('immediate', 'defer')!
        paragraphs = [`Trả cuối vòng: ${upfront.value === 0 ? 'chưa phải chi ngay' : `trả ${readFact(upfront)} ngay`}, nhưng hẹn ${value('future', 'defer')} ở Xuất phát cuối vòng nếu hoàn tất lựa chọn.`, 'Nếu phải huy động thêm tiền, lựa chọn chỉ hoàn tất khi đủ thanh toán; phí bán, lãi vay và lãi tiết kiệm mất chưa nằm trong các khoản trên.']
      } else if (id === 'personal-risk') {
        lead = 'Trả sau giữ tiền mặt lúc này nhưng dồn một khoản phải trả về cuối vòng.'
        paragraphs = [deferred ? `Theo phương án ${subjectLabel(deferred.subject).toLocaleLowerCase('vi')}, khoản hẹn là ${readFact(deferred)} ở Xuất phát.` : 'Chưa có khoản hẹn dương của phương án trả sau để nêu con số.', 'Nghĩa vụ chỉ ghi nhận sau khi hoàn tất khoản đầu; nếu còn huy động vốn thì lựa chọn chưa hoàn tất.', 'Phí bán, lãi vay hoặc lãi tiết kiệm mất khi huy động chưa nằm trong tổng chi phí của lựa chọn.']
      } else if (id === 'personal-rules') {
        const options = p.actions.filter(a => ['pay', 'defer', 'full', 'temporary'].includes(a))
        if (options.length !== 2 || options.some(a => !find('immediate', a) || !find('future', a))) return educationalMissing(question)
        const choices = options.map(a => {
          const now = find('immediate', a)!, later = find('future', a)!
          const upfront = readFact(now), promised = readFact(later)
          if (now.value === 0) return later.value > 0 ? `chưa trả lúc này nhưng hẹn ${promised} vào Xuất phát cuối vòng` : `${subjectLabel(a).toLocaleLowerCase('vi')}: không có khoản trả ngay hoặc hẹn trả`
          const name = a === 'pay' ? 'trả ngay' : subjectLabel(a).toLocaleLowerCase('vi')
          return `${name} ${upfront}${later.value > 0 ? ` ngay và hẹn ${promised} vào Xuất phát cuối vòng` : ''}`
        })
        lead = `Bạn cần chọn một trong hai cách thanh toán: ${choices.join(', hoặc ')}.`
        paragraphs = ['Khoản trả sau chỉ thành nghĩa vụ khi bạn hoàn tất lựa chọn.', 'Nếu phải huy động thêm tiền để thanh toán, chi phí phát sinh như phí bán, lãi vay và lãi tiết kiệm mất được tính riêng; lựa chọn chưa hoàn tất khi còn thiếu tiền.']
      } else {
        const immediate = find('immediate')
        if (!immediate) return educationalMissing(question)
        lead = id === 'personal-cost' ? `${subjectLabel(immediate.subject)} cần ${readFact(immediate)} thanh toán ngay theo phương án đó.` : 'Bạn cần giải quyết chi phí của sự kiện, bằng một trong các lựa chọn đang hợp lệ.'
        paragraphs = [id === 'personal-cost' ? deferred ? `Nếu chọn ${subjectLabel(deferred.subject).toLocaleLowerCase('vi')}, phần hẹn cuối vòng là ${readFact(deferred)} ở Xuất phát.` : 'Chưa có khoản hẹn cuối vòng dương trong dữ kiện đang có.' : `Phương án ${subjectLabel(immediate.subject).toLocaleLowerCase('vi')} có khoản trả ngay ${readFact(immediate)}; xem dữ kiện cho các phương án khác.`, 'Tiền trả ngay khác nghĩa vụ về sau; khoản hẹn chỉ ghi nhận khi bạn hoàn tất thanh toán ban đầu.', 'Nếu thiếu tiền phải huy động thêm, phí bán, lãi vay hoặc lãi tiết kiệm mất chưa được tính vào tổng chi phí lựa chọn.']
      }
    } else if (question.categoryId === 'macro') {
      rule('macro')
      if (id === 'macro-risk') {
        lead = 'Không, tin tốt không bảo đảm bạn có lợi nhuận.'
        paragraphs = ['Giá đã tăng không bảo đảm lãi thực nhận khi bán hoặc giá trong tương lai; biến động giá không tự cộng tiền vào ví.']
        detailCodes = []
      } else {
        const observed = find('observed', 'overall')
        const records = facts.filter(f => f.code === 'change' && find('beforePrice', f.subject) && find('price', f.subject)
          && (id !== 'macro-compare' || find('beforePrice', f.subject)!.value > 0 && find('price', f.subject)!.value > 0))
        if (observed?.value !== 1 || records.length < (id === 'macro-compare' ? 2 : 1)) return educationalMissing(question)
        readFact(observed)
        if (id === 'macro-compare') {
          // Keep published order, adding the missing direction when both directions exist.
          const selected = records.slice(0, 2)
          const rising = records.find(f => f.value > 0), falling = records.find(f => f.value < 0)
          if (rising && falling) {
            if (!selected.some(f => f.value < 0)) selected.push(falling)
            if (!selected.some(f => f.value > 0)) {
              if (selected.length === 3) selected[1] = rising
              else selected.push(rising)
            }
          }
          detailSubjects = new Set(records.map(f => f.subject))
          lead = 'Sau sự kiện, ' + selected.map(f => {
            readFact(find('beforePrice', f.subject)); readFact(find('price', f.subject)); readFact(f)
            return `${subjectLabel(f.subject)} ${f.value === 0 ? 'không đổi giá' : `${f.value > 0 ? 'tăng' : 'giảm'} ${Math.abs(f.value).toLocaleString('vi-VN')} đ`}`
          }).join('; ') + ' theo giá mỗi đơn vị được công bố.'
          const directions = rising && falling ? 'Có tài sản tăng và có tài sản giảm, không phải tài sản nào cũng biến động cùng chiều.'
            : records.every(f => f.value > 0) ? 'Các tài sản có dữ kiện phù hợp đều tăng trong sự kiện này.'
              : records.every(f => f.value < 0) ? 'Các tài sản có dữ kiện phù hợp đều giảm trong sự kiện này.'
                : records.every(f => f.value === 0) ? 'Các tài sản có dữ kiện phù hợp đều không đổi giá trong sự kiện này.'
                  : 'Các ví dụ đã ghi nhận có biến động cùng chiều hoặc không đổi giá.'
          paragraphs = [directions + ' Đây là thay đổi giá đã xảy ra, không phải lợi nhuận đã nhận hoặc dự báo cho vòng sau.', 'Sự kiện đã được áp dụng, không áp lại khi hỏi AI hoặc qua Xuất phát; biến động giá không tự cộng tiền vào ví.']
        } else {
          const change = records[0]
          const direction = change.value > 0 ? 'lên' : change.value < 0 ? 'xuống' : 'giữ ở'
          lead = `Sự kiện đã ghi nhận giá ${subjectLabel(change.subject)} từ ${value('beforePrice', change.subject)} ${direction} ${value('price', change.subject)}.`
          paragraphs = ['Đây là biến động giá tài sản, không phải tiền tự cộng vào ví; không cho biết giá lần sau.', 'Sự kiện đã được áp dụng, không áp lại khi hỏi AI hoặc qua Xuất phát.']
        }
      }
    } else {
      const kind = id === 'start-summary' ? 'summary' : id === 'start-actions' ? 'rebalancing' : 'forecast'; rule(kind)
      if (id === 'start-summary') {
        const livingIndex = p.entries.findIndex(e => e.label === 'Chi phí sinh hoạt' && e.amount <= 0)
        if (livingIndex < 0) return educationalMissing(question)
        const living = p.entries[livingIndex]
        sources.push({ kind: 'entry', code: 'entry', subject: String(livingIndex), value: living.amount })
        lead = `Lần qua Xuất phát này đã ghi nhận ${value('received')} thu nhập và ${Math.abs(living.amount).toLocaleString('vi-VN')} đ chi phí sinh hoạt.`
        paragraphs = ['Các khoản nợ và nghĩa vụ khác, nếu có, nằm trong “Xem thêm dữ kiện”; đây là khoản đã ghi nhận, không phải dự báo.']
      } else if (id === 'start-forecast') {
        lead = 'Bản tin đầu vòng mô tả biến động kinh tế đang được công bố để bạn quan sát.'
        paragraphs = ['Bản tin không dự báo giá tiếp theo và không tiết lộ kết quả xúc xắc hoặc sự kiện chưa xảy ra.']
        detailCodes = []
      } else {
        lead = 'Ở bước này, bạn có thể quản lý việc bán tài sản tài chính và trả nợ theo quyền hiện có.'
        paragraphs = ['Không mua mới tài sản tại bước này; quyền bán và trả nợ vẫn phụ thuộc tài sản và tiền đang có.', 'Báo giá hoặc phương án đang nhập chưa phải giao dịch đã thực hiện; trả nợ có thể còn phải trả lãi theo luật.']
      }
    }
  }
  if (absent || !lead) return educationalMissing(question)
  const details: AnswerDetail[] = []
  for (const f of facts.filter(f => detailCodes.includes(f.code) && (!detailSubjects || detailSubjects.has(f.subject)))) {
    // Never frame the posted price of a completed course as a new payment obligation.
    const completed = f.code === 'courseCost' && find('owned', f.subject)?.value === 1
    details.push({ key: `${f.code}:${f.subject}`, label: `${f.subject === 'overall' ? '' : subjectLabel(f.subject) + ' · '}${completed ? 'Học phí niêm yết của khóa đã hoàn thành, không phải đóng thêm' : LABELS[f.code] ?? 'Dữ kiện đã công bố'}`, value: readFact(f) })
  }
  for (const l of d?.lines ?? []) {
    sources.push({ kind: 'line', ...l })
    details.push({ key: `line:${l.code}`, label: draftLineLabels[l.code], value: ['term', 'maturity'].includes(l.code) ? String(l.value) : `${l.value.toLocaleString('vi-VN')} đ` })
  }
  if (id === 'start-summary') p?.entries.forEach((entry, index) => {
    sources.push({ kind: 'entry', code: 'entry', subject: String(index), value: entry.amount })
    details.push({ key: `entry:${index}`, label: entry.label, value: `${entry.amount.toLocaleString('vi-VN')} đ` })
  })
  const uniqueSources = [...new Map(sources.map(source => [JSON.stringify(source), source])).values()]
  return { lead, paragraphs, details, sources: uniqueSources, rules, missing: false }
}
