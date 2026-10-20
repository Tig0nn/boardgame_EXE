import { localizePlayerText } from './player-language.ts'
/** Presentation-only dictionary. Never used by settlement, pricing or replay. */
export const FINANCIAL_TERMS = {
  coupon: { label: 'Lãi trái phiếu định kỳ', english: 'Coupon', definition: 'Khoản lãi tính trên mệnh giá đang nắm giữ; có thể chậm trả hoặc không được trả đủ. Lãi này khác với tổng lợi nhuận, còn phụ thuộc giá mua/bán và phí.', aliases: ['Lãi trái phiếu định kỳ', 'lãi trái phiếu định kỳ', 'Lãi trái phiếu', 'lãi trái phiếu'] },
  issuer: { label: 'Tổ chức phát hành', english: 'Issuer', definition: 'Đơn vị phát hành trái phiếu để vay tiền từ nhà đầu tư và có trách nhiệm trả nợ.', aliases: ['Tổ chức phát hành', 'tổ chức phát hành'] },
  rating: { label: 'Xếp hạng tín nhiệm', english: 'Credit rating', definition: 'Đánh giá mức độ rủi ro trả nợ trong trò chơi, không phải xếp hạng thực tế.', aliases: ['Xếp hạng tín nhiệm', 'xếp hạng tín nhiệm'] },
  spread: { label: 'Chênh lệch giá mua–bán', english: 'Spread', definition: 'Chênh lệch khiến giá bán lại thấp hơn giá mua ở cùng thời điểm; tách biệt phí giao dịch.', aliases: ['Chênh lệch giá mua–bán', 'chênh lệch giá mua–bán'] },
  liquidity: { label: 'Khả năng chuyển thành tiền', english: 'Liquidity', definition: 'Khả năng biến tài sản thành tiền để thanh toán, có thể chịu phí hoặc tổn thất. Có tài sản không có nghĩa luôn bán ngay được; quán chỉ bán tại ô Kinh doanh.', aliases: ['Khả năng chuyển thành tiền', 'khả năng chuyển thành tiền', 'thanh khoản'] },
  funding: { label: 'Huy động tiền thanh toán', english: 'Funding', definition: 'Dùng các nguồn tiền hợp lệ để trả khoản đang thiếu. Tiền mặt dùng trước; sau đó có thể rút tiết kiệm, bán tài sản tài chính hoặc vay trong hạn mức. Không bán quán để trả khẩn cấp.', aliases: ['Huy động tiền thanh toán', 'huy động tiền thanh toán'] },
  maturity: { label: 'Đáo hạn', english: 'Maturity', definition: 'Thời điểm đến hạn trả gốc hoặc lãi theo hợp đồng.', aliases: ['Đáo hạn', 'đáo hạn'] },
  default: { label: 'Vỡ nợ', english: 'Default', definition: 'Tổ chức không thực hiện đầy đủ nghĩa vụ; người chơi có thể mất một phần vốn.', aliases: ['Vỡ nợ', 'vỡ nợ'] },
  payback: { label: 'Hoàn vốn', english: 'Payback', definition: 'Thời điểm thu nhập tăng thêm tích lũy đủ bù số tiền ban đầu đã bỏ ra. Đây là thời gian bù vốn, khác tỷ suất sinh lời (ROI); không phải cam kết lợi nhuận.', aliases: ['Hoàn vốn', 'hoàn vốn'] },
  faceValue: { label: 'Mệnh giá', english: 'Face value', definition: 'Giá trị làm căn cứ tính gốc và lãi hợp đồng, có thể khác giá mua trên thị trường.', aliases: ['Mệnh giá', 'mệnh giá'] },
  start: { label: 'Ô Xuất phát', english: 'START', definition: 'Mốc quyết toán vòng: thị trường, lương và các khoản đến hạn. Đi ngang ô này cũng quyết toán theo luật của ván. START là tên kỹ thuật trong dữ liệu.', aliases: ['Ô Xuất phát', 'ô Xuất phát'] },
  netWorth: { label: 'Tài sản ròng', english: 'Net worth', definition: 'Tổng giá trị tài sản theo cách định giá của ván, trừ nợ và nghĩa vụ. Khác tiền mặt và khác số tiền hợp lệ để về đích.', aliases: ['Tài sản ròng', 'tài sản ròng'] },
  proceeds: { label: 'Giá trị huy động hợp lệ', english: 'Eligible proceeds', definition: 'Tiền mặt, gốc tiết kiệm rút hợp lệ và tiền bán tài sản tài chính sau phí, trừ nợ và khoản phải trả. Không tính quán chưa bán hoặc lãi chưa nhận; trò chơi không tự bán tài sản.', aliases: ['Giá trị huy động hợp lệ', 'giá trị huy động hợp lệ'] },
} as const
export type FinancialTermId = keyof typeof FINANCIAL_TERMS
export type TermPart = { text: string; term?: FinancialTermId }

/** Annotate exact, reviewed phrases only. Text and selector data are never rewritten. */
export function annotateTerms(text: string): TermPart[] {
  const parts: TermPart[] = [], used = new Set<FinancialTermId>()
  let offset = 0
  while (offset < text.length) {
    let next: { index: number; alias: string; term: FinancialTermId } | undefined
    for (const term of Object.keys(FINANCIAL_TERMS) as FinancialTermId[]) {
      if (used.has(term)) continue
      for (const alias of FINANCIAL_TERMS[term].aliases) {
        const index = text.indexOf(alias, offset)
        if (index >= 0 && (!next || index < next.index || index === next.index && alias.length > next.alias.length)) next = { index, alias, term }
      }
    }
    if (!next) { parts.push({ text: text.slice(offset) }); break }
    if (next.index > offset) parts.push({ text: text.slice(offset, next.index) })
    parts.push({ text: next.alias, term: next.term }); used.add(next.term)
    offset = next.index + next.alias.length
  }
  return parts
}

const narrativeWords: Record<string, string> = {
  coupon: FINANCIAL_TERMS.coupon.label.toLowerCase(), issuer: FINANCIAL_TERMS.issuer.label.toLowerCase(), spread: FINANCIAL_TERMS.spread.label.toLowerCase(),
  funding: FINANCIAL_TERMS.funding.label.toLowerCase(), liquidity: FINANCIAL_TERMS.liquidity.label.toLowerCase(), default: FINANCIAL_TERMS.default.label.toLowerCase(),
  savings: 'tiết kiệm', financial: 'tài sản tài chính', stocks: 'cổ phiếu', bonds: 'trái phiếu',
  gold: 'vàng', business: 'kinh doanh', course: 'khóa học', reserve: 'dự phòng', scenario: 'bối cảnh',
  game: 'trò chơi', lot: 'khoản', seed: 'mã hành trình',
}
/** Only human narrative fields pass here, never JSON, IDs, prices or state. Whole Latin
 * words keep API identifiers (couponRate, issuerId) intact; React still escapes output. */
export function localizeNarrative(text: string): string {
  return localizePlayerText(text).replace(/[A-Za-z]+/g, word => {
    const translation = narrativeWords[word.toLowerCase()]
    return translation ? (word[0] === word[0].toUpperCase() ? translation[0].toUpperCase() + translation.slice(1) : translation) : word
  })
}

type Band = { top: number; bottom: number }
export function tooltipPosition(anchor: { left: number; top: number; bottom: number }, viewportWidth: number, viewportHeight: number, height: number, actions: Band[]) {
  const width = Math.min(300, viewportWidth - 16), left = Math.max(8, Math.min(anchor.left, viewportWidth - width - 8))
  const blocked = actions.filter(a => a.bottom > 0 && a.top < viewportHeight).sort((a, b) => a.top - b.top)
  const bands: Band[] = []
  let top = 8
  for (const a of blocked) { if (a.top - 8 > top) bands.push({ top, bottom: a.top - 8 }); top = Math.max(top, a.bottom + 8) }
  if (viewportHeight - 8 > top) bands.push({ top, bottom: viewportHeight - 8 })
  const desired = Math.min(height, viewportHeight - 16)
  for (const y of [anchor.bottom + 8, anchor.top - desired - 8]) {
    if (bands.some(b => y >= b.top && y + desired <= b.bottom)) return { left, top: y, width, maxHeight: desired }
  }
  const best = bands.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))[0] ?? { top: 8, bottom: viewportHeight - 8 }
  const maxHeight = Math.min(desired, best.bottom - best.top)
  return { left, top: Math.max(best.top, Math.min(anchor.top - maxHeight - 8, best.bottom - maxHeight)), width, maxHeight }
}
