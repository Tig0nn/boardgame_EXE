import { ASSETS } from '../../../src/data/config.ts'
import { money } from '../../../src/game/format.ts'
import { readExplanationContext } from '../../../src/ai/mascot/contracts.ts'
import type { ExplanationContext, Facts, Topic } from '../../../src/ai/mascot/contracts.ts'
import type { MascotInsight } from './mascot-coach.ts'

export function explanationContext(insight: MascotInsight) {
  return readExplanationContext(insight.explanation)
}

const copy: Record<Topic, { summary: string; practical: string }> = {
  concentration: {
    summary: 'Nếu cần thêm tiền sau khi dành đủ cho các khoản đã ghi nhận, bạn chỉ chuyển được tài sản sang tiền theo điều kiện game cho phép.',
    practical: 'Kiểm tra tiền mặt còn dùng được và ô cho phép bán hoặc rút nhóm tài sản đó.',
  },
  'payment-gap': {
    summary: 'Khoản đang chờ thanh toán cần được xử lý trước khi ván tiếp tục.',
    practical: 'Nếu phải huy động tiền, so số thực nhận từ các nguồn game đang cho phép.',
  },
  'cash-drop': {
    summary: 'Tiền đã chi giảm phần ngân sách dùng ngay. Riêng mức giảm này chưa cho biết có thiếu tiền để trả hay không.',
    practical: 'Đối chiếu số dư với các khoản đã ghi nhận trước khi chi tiếp.',
  },
  'cash-exhaustion': {
    summary: 'Các khoản tiết kiệm hoặc tài sản còn nắm giữ có thể là nguồn vốn tuỳ điều kiện của ván.',
    practical: 'Nếu cần bán để lấy tiền, hãy kiểm tra điều kiện bán và số tiền thực nhận trong game.',
  },
  debt: {
    summary: 'Nếu dùng tiền mặt hiện có để trả gốc, phần dành cho các khoản chi khác sẽ giảm. Số dư gốc chưa cho biết thời điểm hay tổng số tiền phải trả.',
    practical: 'Ở bước trả nợ, xem số tiền game báo phải trả và phần tiền mặt còn lại.',
  },
  deposit: {
    summary: 'Khoản gửi tự đáo hạn ở vòng ghi bên dưới nếu ván đi tới mốc đó. Khi thiếu tiền cho khoản bắt buộc, game cho rút toàn bộ một khoản đang hoạt động và bạn mất phần lãi của khoản đó.',
    practical: 'So mốc đáo hạn với những khoản đã ghi nhận để biết phần nào cần giữ bằng tiền mặt.',
  },
  buy: {
    summary: 'Muốn dùng vốn vừa đầu tư để chi, bạn cần bán ở thời điểm game cho phép.',
    practical: 'So số dư với các khoản đã ghi nhận trước khi quyết định chi thêm.',
  },
  upgrade: {
    summary: 'Phần vốn đã bỏ vào cơ sở không thể dùng ngay để thanh toán.',
    practical: 'So tiền mặt còn lại với các khoản đã ghi nhận trước lần nâng cấp tiếp theo.',
  },
  sell: {
    summary: 'Số tiền tăng trên ví là số thực nhận sau giao dịch. Sau khi bán, danh mục sẽ ít phụ thuộc hơn vào phần tài sản vừa chuyển thành tiền.',
    practical: 'Xem số thực nhận khi kiểm tra khả năng thanh toán.',
  },
  repay: {
    summary: 'Tiền mặt đã chi và phần gốc giảm là hai số khác nhau. Khoản trả có thể gồm lãi theo số game ghi nhận.',
    practical: 'Đối chiếu hai số trước khi cân nhắc trả thêm.',
  },
  borrow: {
    summary: 'Tiền vay dùng cho khoản cần trả. Phần vay làm tăng số gốc bạn phải theo dõi trong ví.',
    practical: 'Dùng số nợ gốc còn lại để theo dõi khoản vay đến bước game báo trả nợ.',
  },
  'debt-reduced': {
    summary: 'Nếu trả nợ bằng tiền mặt, khoản đó làm giảm ngân sách dùng ngay. Số dư cuối lượt còn phản ánh các khoản thu hoặc chi khác trong cùng lượt.',
    practical: 'Xem tiền mặt còn lại trước khi chi thêm.',
  },
  'coverage-restored': {
    summary: 'Phần ngân sách còn linh hoạt là số tiền dư ra sau khi dành đủ cho các khoản đã biết.',
    practical: 'Dùng số dư sau khi dành tiền để cân nhắc giao dịch tiếp theo.',
  },
  'goal-progress': {
    summary: 'Game đo tiến độ bằng số tiền có thể huy động hợp lệ. Giá trị tài sản trong ví có thể khác số tiền huy động được tại mốc này.',
    practical: 'Đối chiếu khoảng cách còn lại với số tiền game ghi nhận cho mục tiêu.',
  },
}

const labels: Record<string, string> = {
  asset: 'Tài sản đã mua', value: 'Giá trị nhóm', gross: 'Tổng giá trị tài sản', share: 'Tỷ trọng (làm tròn xuống)', group: 'Nhóm tài sản',
  cash: 'Tiền mặt còn lại', knownPayments: 'Khoản phải trả đã ghi nhận', pending: 'Đang chờ thanh toán',
  cashDrop: 'Tiền mặt đã giảm', debt: 'Nợ gốc còn lại', amount: 'Số tiền giao dịch', cashBefore: 'Tiền mặt trước giao dịch',
  term: 'Kỳ hạn', maturityLap: 'Vòng đáo hạn', rate: 'Lãi suất mỗi kỳ', debtReduced: 'Nợ gốc đã giảm', paid: 'Đã thanh toán',
  improvement: 'Khoảng cách đã thu hẹp', remaining: 'Còn cách mục tiêu', target: 'Mục tiêu của ván',
}

export function explainMascot(context: ExplanationContext, evidence?: Facts) {
  const narrative = copy[context.topic]
  const localFacts = { ...context.facts }
  if (context.topic === 'buy' || context.topic === 'concentration') {
    for (const key of context.topic === 'buy' ? ['knownPayments'] : ['cash', 'knownPayments']) {
      const amount = evidence?.[key]
      if (typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0) localFacts[key] = amount
    }
  }
  const facts = Object.entries(localFacts).map(([key, value]) => {
    if (typeof value === 'string') {
      const group = value as keyof typeof ASSETS | 'savings'
      return { label: labels[key], value: group === 'savings' ? 'Tiết kiệm' : ASSETS[group].label }
    }
    const formatted = key === 'share' ? `${value}%` : key === 'rate'
      ? value.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 2 })
      : key === 'term' ? `${value} vòng` : key === 'maturityLap' ? String(value) : money(value)
    return { label: labels[key], value: formatted }
  })
  let text = `${narrative.summary} ${narrative.practical}`
  if (context.topic === 'payment-gap' && context.facts.pending === 0) {
    text = 'Khoản đã hẹn được xử lý khi game đến mốc thanh toán. Kiểm tra mốc đó và nguồn tiền có thể dùng trước khi chi thêm.'
  }
  if (context.topic === 'cash-exhaustion') {
    const asset = ASSETS[context.facts.asset as keyof typeof ASSETS].label.toLocaleLowerCase('vi-VN')
    const payments = localFacts.knownPayments === 0 ? 'Ván chưa ghi nhận khoản phải trả tại mốc này.' : ''
    const sale = localFacts.asset === 'gold'
      ? 'Để đổi vàng thành tiền, hãy kiểm tra lúc game cho phép bán, phí và chênh lệch giá mua bán (spread).'
      : narrative.practical
    text = [`Giao dịch đã chuyển tiền mặt sang ${asset}, giảm phần có thể dùng để chi ngay.`, payments,
      narrative.summary, sale].filter(Boolean).join(' ')
  }
  if (context.topic === 'buy' && localFacts.knownPayments === 0) {
    text = `${narrative.summary} Ván chưa ghi nhận khoản phải trả ở mốc này, nên chưa có căn cứ kết luận bạn thiếu tiền để thanh toán.`
  }
  return { narrative: text, facts }
}
