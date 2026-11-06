import { B18_BOARD, boardFor } from '../../../src/data/board.ts'
import type { GameState, TileType } from '../../../src/game/types.ts'
import { DOMAINS } from '../../../src/ai/companion/universal/types.ts'
import type { GameplayDomain, GameplayIntent } from '../../../src/ai/companion/universal/types.ts'
import type { SemanticRoute } from '../../../src/ai/companion/semantic/types.ts'
import type { DraftInput } from '../../../src/ai/companion/draft/types.ts'

export type CuratedCategoryId = 'start' | 'bank' | 'stocks' | 'bonds' | 'gold' | 'business' | 'course' | 'personal' | 'macro' | 'finance'
const tileTypes = ['start', 'bank', 'stocks', 'bonds', 'gold', 'business', 'course', 'personal', 'macro'] as const
export const CURATED_CATEGORIES: { id: CuratedCategoryId; tileType: TileType | null; label: string }[] = [
  ...tileTypes.map(type => ({ id: type, tileType: type, label: type === 'bank' ? 'Ngân hàng / Tiết kiệm' : type === 'macro' ? 'Sự kiện / Kinh tế' : B18_BOARD.find(tile => tile.type === type)!.label })),
  { id: 'finance', tileType: null, label: 'Tài chính cá nhân' },
]
export function currentTileName(game: GameState): string {
  try { return boardFor(game)[game.position]?.label ?? 'Chưa xác định' } catch { return 'Chưa xác định' }
}
export interface FactRequirement { code: string; subjects?: readonly string[]; value?: number }
export interface CuratedQuestion {
  id: string; categoryId: CuratedCategoryId; tileType: TileType | null; text: string
  domains: readonly GameplayDomain[]; intent: GameplayIntent; focus: SemanticRoute['focus']; scope: 'actual' | 'draft'
  requiredFacts: readonly FactRequirement[]; requiredActions: readonly string[]
  requiredDraft?: Partial<Pick<DraftInput, 'form' | 'operation' | 'asset'>>
  displayFacts: readonly string[]; fallback: string; safety: 'p4-and-canonical'
}
const unavailable = 'Hãy hỏi khi mở đúng nhóm ô và có dữ kiện đã công bố cho câu này.'
function q(id: string, categoryId: CuratedCategoryId, text: string, domains: readonly GameplayDomain[], intent: GameplayIntent, focus: SemanticRoute['focus'], displayFacts: readonly string[], extra: Partial<Pick<CuratedQuestion, 'requiredFacts' | 'requiredActions' | 'requiredDraft' | 'fallback'>> = {}): CuratedQuestion {
  return { id, categoryId, tileType: categoryId === 'finance' ? null : categoryId, text, domains, intent, focus, displayFacts,
    scope: extra.requiredDraft ? 'draft' : 'actual', requiredFacts: [], requiredActions: [], fallback: unavailable, safety: 'p4-and-canonical', ...extra }
}
export const CURATED_QUESTIONS: readonly CuratedQuestion[] = [
  q('start-summary', 'start', 'START vừa xử lý những gì?', ['summary'], 'explain', 'general', ['received', 'debtPaid'], { requiredFacts: [{ code: 'received' }], fallback: 'Cần bản tổng kết khi vừa qua Xuất phát. Hãy mở tổng kết vòng để xem các khoản đã xử lý.' }),
  q('start-actions', 'start', 'Tại START tôi được làm gì?', ['rebalancing'], 'explain', 'general', ['cash', 'debt'], { fallback: 'Cần đang ở bước quản lý tài sản sau tổng kết Xuất phát. Chưa có quyền thao tác của bước đó trong trạng thái này.' }),
  q('start-forecast', 'start', 'Bản tin đầu vòng có nghĩa gì?', ['forecast'], 'explain', 'general', ['salary', 'living'], { fallback: 'Cần bản tin đầu vòng đang được công bố; không đọc bản tin hoặc sự kiện tương lai.' }),

  q('bank-rules', 'bank', 'Gửi tiết kiệm hoạt động thế nào?', ['bank'], 'explain', 'general', ['rate'], { requiredFacts: [{ code: 'rate' }] }),
  q('bank-risk', 'bank', 'Rút trước hạn ảnh hưởng đến lãi ra sao?', ['bank'], 'risk', 'general', ['lost', 'maturity']),
  q('bank-compare', 'bank', 'So sánh các kỳ hạn tiết kiệm', ['bank'], 'compare', 'general', ['rate'], { requiredFacts: [{ code: 'rate', subjects: ['term-1', 'term-2', 'term-3'] }], fallback: 'Cần lãi suất đã công bố của các kỳ hạn 1, 2 và 3 kỳ để so sánh. Chưa đủ dữ kiện các kỳ hạn này.' }),
  q('bank-maturity', 'bank', 'Khi nào tiết kiệm đáo hạn?', ['bank'], 'cashflow', 'maturity', ['principal', 'interest', 'maturity'], { requiredFacts: [{ code: 'maturity' }], fallback: 'Cần ít nhất một khoản tiết kiệm đang hoạt động có kỳ đáo hạn hợp lệ; hiện chưa có khoản phù hợp.' }),
  q('bank-draft-cash', 'bank', 'Gửi khoản đang nhập thì ví tôi còn bao nhiêu?', ['bank'], 'cashflow', 'liquidity', [], { requiredDraft: { form: 'bank', operation: 'deposit' }, fallback: 'Hãy mở Ngân hàng, nhập số tiền và chọn kỳ hạn cho khoản gửi hợp lệ, rồi hỏi lại. Chưa có báo giá khoản gửi phù hợp.' }),

  q('stocks-rules', 'stocks', 'Cổ phiếu hoạt động thế nào?', ['stocks'], 'explain', 'fees', ['price', 'holding']),
  q('stocks-price', 'stocks', 'Giá cổ phiếu hiện tại là bao nhiêu?', ['stocks'], 'explain', 'fees', ['price'], { requiredFacts: [{ code: 'price' }] }),
  q('stocks-risk', 'stocks', 'Cổ phiếu có rủi ro gì?', ['stocks'], 'risk', 'fees', ['fee', 'net']),
  q('stocks-sale', 'stocks', 'Tôi sẽ trả hoặc nhận bao nhiêu với giá trị đang nhập?', ['stocks'], 'cashflow', 'general', ['gross', 'spread', 'fee', 'net'], { requiredFacts: [{ code: 'net' }], requiredDraft: { form: 'investment', operation: 'sell', asset: 'stocks' }, fallback: 'Hãy chọn Bán tại ô Cổ phiếu, chọn mã đang sở hữu và nhập giá trị bán hợp lệ. Cần draft Bán cùng báo giá của mã đó để nêu số tiền nhận sau phí.' }),
  q('stocks-draft-cash', 'stocks', 'Mua khoản đang nhập thì ví tôi còn bao nhiêu?', ['stocks'], 'cashflow', 'liquidity', [], { requiredDraft: { form: 'investment', operation: 'buy', asset: 'stocks' }, fallback: 'Hãy mở ô Cổ phiếu, chọn mã và nhập số tiền mua hợp lệ. Chưa có draft và báo giá mua cổ phiếu phù hợp.' }),

  q('bonds-rules', 'bonds', 'Trái phiếu hoạt động thế nào?', ['bonds'], 'explain', 'fees', ['coupon', 'creditState']),
  q('bonds-coupon', 'bonds', 'Coupon là gì?', ['bonds'], 'explain', 'general', ['coupon'], { requiredFacts: [{ code: 'coupon' }] }),
  q('bonds-risk', 'bonds', 'Nếu trái phiếu bị chậm trả thì sao?', ['bonds'], 'risk', 'fees', ['creditState', 'outstanding', 'loss', 'coupon']),
  q('bonds-compare', 'bonds', 'Hai tổ chức phát hành khác nhau thế nào?', ['bonds'], 'compare', 'general', ['coupon', 'creditState', 'price'], { requiredFacts: [{ code: 'coupon', subjects: ['an-tam', 'but-pha'] }], fallback: 'Cần dữ kiện đã công bố của cả An Tâm và Bứt Phá để so sánh coupon và trạng thái tín dụng; chưa đủ hai bên.' }),

  q('gold-rules', 'gold', 'Vàng trong game hoạt động thế nào?', ['gold'], 'explain', 'general', ['price', 'holding']),
  q('gold-price', 'gold', 'Giá vàng hiện tại là bao nhiêu?', ['gold'], 'explain', 'general', ['price'], { requiredFacts: [{ code: 'price', subjects: ['gold'] }] }),
  q('gold-risk', 'gold', 'Vàng có rủi ro gì?', ['gold'], 'risk', 'general', ['spread', 'fee', 'net']),
  q('gold-sale', 'gold', 'Tôi sẽ trả hoặc nhận bao nhiêu với giá trị đang nhập?', ['gold'], 'cashflow', 'general', ['gross', 'spread', 'fee', 'net'], { requiredFacts: [{ code: 'net', subjects: ['gold'] }], requiredDraft: { form: 'investment', operation: 'sell', asset: 'gold' }, fallback: 'Hãy chọn Bán tại ô Vàng và nhập giá trị bán hợp lệ từ vàng đang sở hữu. Cần draft Bán cùng báo giá tương ứng để nêu tiền nhận sau spread/phí.' }),
  q('gold-draft-cash', 'gold', 'Mua khoản đang nhập thì ví tôi còn bao nhiêu?', ['gold'], 'cashflow', 'liquidity', [], { requiredDraft: { form: 'investment', operation: 'buy', asset: 'gold' }, fallback: 'Hãy mở ô Vàng và nhập số tiền mua hợp lệ. Chưa có draft và báo giá mua vàng phù hợp.' }),

  q('business-rules', 'business', 'Kinh doanh hoạt động thế nào?', ['business'], 'explain', 'general', ['purchaseCost', 'businessIncome', 'capital']),
  q('business-risk', 'business', 'Kinh doanh có rủi ro gì?', ['business'], 'risk', 'general', ['capital', 'upgradeCost', 'incremental']),
  q('business-cash', 'business', 'Mua quán ảnh hưởng tiền mặt thế nào?', ['business'], 'cashflow', 'liquidity', ['cash', 'purchaseCost'], { requiredFacts: [{ code: 'purchaseCost' }] }),

  q('course-rules', 'course', 'Khóa học hoạt động thế nào?', ['course'], 'explain', 'general', ['courseCost', 'courseBoost', 'owned']),
  q('course-compare', 'course', 'Hai khóa học khác nhau thế nào?', ['course'], 'compare', 'general', ['courseCost', 'courseBoost', 'courseNominal', 'courseNet'], { requiredActions: ['course-basic', 'course-advanced'], requiredFacts: [{ code: 'courseCost', subjects: ['basic', 'advanced'] }], fallback: 'Cần hai lựa chọn hợp lệ: khóa cơ bản và khóa nâng cao tại ô Đầu tư bản thân. Nếu đã sở hữu một khóa hoặc chưa đủ quyền/tiền học, chưa thể so sánh hai lựa chọn mua đang khả dụng.' }),
  q('course-risk', 'course', 'Học phí có được hoàn lại không?', ['course'], 'risk', 'fees', ['courseCost']),
  q('course-cash', 'course', 'Học phí ảnh hưởng tiền mặt thế nào?', ['course'], 'cashflow', 'fees', ['cash', 'courseCost', 'courseBoost']),

  q('personal-rules', 'personal', 'Tình huống này yêu cầu gì?', ['personal'], 'explain', 'general', ['immediate', 'future']),
  q('personal-compare', 'personal', 'Thanh toán ngay hay trả sau khác nhau thế nào?', ['personal'], 'compare', 'obligation', ['immediate', 'future', 'total', 'after'], { requiredActions: ['pay', 'defer'], fallback: 'Cần hai lựa chọn đang hợp lệ: thanh toán ngay và thanh toán cuối vòng, trong cùng sự kiện. Nếu sự kiện chỉ có phương án khác, hãy xem chi phí của tình huống thay vì ghép hai báo giá.' }),
  q('personal-risk', 'personal', 'Trả sau có rủi ro gì?', ['personal'], 'risk', 'obligation', ['future', 'obligations']),
  q('personal-cost', 'personal', 'Chi phí của tình huống này là gì?', ['personal'], 'cashflow', 'fees', ['immediate', 'future', 'total', 'after', 'shortfall'], { requiredFacts: [{ code: 'immediate' }], fallback: 'Cần các khoản phải trả của sự kiện cá nhân đang được công bố. Không dùng chi phí của sự kiện chưa xuất hiện.' }),

  q('macro-rules', 'macro', 'Tin kinh tế này có nghĩa gì?', ['macro'], 'explain', 'general', ['change', 'beforePrice', 'price'], { requiredFacts: [{ code: 'observed', value: 1 }], fallback: 'Cần bản ghi công khai của cú sốc đã xảy ra. Chưa có dữ kiện quan sát hợp lệ để giải thích sự kiện này.' }),
  q('macro-compare', 'macro', 'Các tài sản đã biến động khác nhau thế nào sau sự kiện?', ['macro'], 'compare', 'general', ['change', 'beforePrice', 'price'], { requiredFacts: [{ code: 'observed', value: 1 }, { code: 'beforePrice' }, { code: 'price' }, { code: 'change' }], fallback: 'Cần ít nhất hai tài sản có giá trước, giá sau và biến động đã công bố trong cùng sự kiện. Không giải thích nguyên nhân hoặc dùng giá tương lai.' }),
  q('macro-risk', 'macro', 'Tin tốt có đảm bảo lợi nhuận không?', ['macro'], 'risk', 'general', ['change'], { requiredFacts: [{ code: 'observed', value: 1 }], fallback: 'Cần bản ghi công khai của cú sốc đã xảy ra. Chưa có dữ kiện quan sát hợp lệ; không suy đoán giá hoặc sự kiện tương lai.' }),

  q('finance-cash', 'finance', 'Tiền mặt hiện có là bao nhiêu?', DOMAINS, 'cashflow', 'liquidity', ['cash'], { requiredFacts: [{ code: 'cash' }] }),
  q('finance-obligations', 'finance', 'Nghĩa vụ đã cam kết là gì?', DOMAINS, 'cashflow', 'obligation', ['obligations', 'paymentTotal', 'remaining'], { requiredFacts: [{ code: 'obligations' }] }),
  q('finance-income', 'finance', 'Thu nhập và sinh hoạt định kỳ là gì?', DOMAINS, 'cashflow', 'income', ['salary', 'living', 'received'], { requiredFacts: [{ code: 'salary' }, { code: 'living' }] }),
]
export const questionsForCategory = (categoryId: string) => CURATED_QUESTIONS.filter(question => question.categoryId === categoryId)
