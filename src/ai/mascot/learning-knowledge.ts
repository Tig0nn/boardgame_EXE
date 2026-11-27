export type LearningScope = 'GENERAL_FINANCE' | 'EXE_RULE' | 'GAME_FACT' | 'UNKNOWN'

type VerifiedKnowledge = {
  id: string
  scope: LearningScope
  text: string
  references: readonly string[]
}

export const learningKnowledge: readonly VerifiedKnowledge[] = [
  {
    id: 'risk-difference', scope: 'GENERAL_FINANCE',
    text: 'Rủi ro thanh khoản là nguy cơ không chuyển được tài sản thành tiền đúng lúc hoặc phải chấp nhận bán với giá bất lợi. Rủi ro thị trường là nguy cơ tài sản mất giá do biến động thị trường. Một bên liên quan đến khả năng bán khi cần tiền, bên kia liên quan đến giá trị tài sản.',
    references: [
      'https://www.investor.gov/introduction-investing/investing-basics/what-risk',
      'https://www.finra.org/sites/default/files/Investors_Guide_to_Securities_Industry_Disputes.pdf',
    ],
  },
  {
    id: 'risk-example-exe', scope: 'EXE_RULE',
    text: 'Ví dụ trong EXE, nếu giá vàng giảm thì giá trị vàng đang giữ giảm. Ngay cả khi giá vàng không đổi, bạn vẫn có thể thiếu tiền để chi ngay nếu chưa đến lượt được bán. Khi có thể bán, hãy phân biệt giá niêm yết với số tiền thực nhận sau phí và chênh lệch mua bán.',
    references: ['src/game/market.ts#updateNormalMarket', 'src/game/transactions.ts#transact', 'src/game/selectors.ts#saleQuote'],
  },
  {
    id: 'diversification', scope: 'GENERAL_FINANCE',
    text: 'Đa dạng hóa giúp giảm rủi ro tập trung bằng cách chia tiền vào các khoản đầu tư có thể biến động khác nhau. Cách này không bảo đảm có lời. Nhiều khoản vẫn có thể cùng mất giá.',
    references: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/diversification',
      'https://www.investor.gov/introduction-investing/getting-started/asset-allocation'],
  },
  {
    id: 'diversification-exe', scope: 'EXE_RULE',
    text: 'Trong EXE, danh mục có nhiều loại tài sản vẫn có thể hụt mục tiêu nếu nguồn huy động hợp lệ chưa đủ. Hãy xem khoản nào dùng để chi ngay, khoản nào chỉ thành tiền khi bán hoặc rút, và số còn lại sau phí, nợ và nghĩa vụ.',
    references: ['src/game/selectors.ts#liquidatableFunds', 'src/game/selectors.ts#victory', 'src/game/transactions.ts#transact'],
  },
  {
    id: 'diversification-limit', scope: 'UNKNOWN',
    text: 'Mình chưa đủ dữ kiện về cách phân bổ danh mục qua các vòng để xác nhận bạn đã đa dạng hóa đến mức nào hoặc kết luận vì sao ván đạt hay hụt mục tiêu.',
    references: ['mobile_app/src/game/mascot-learning-context.ts#projectLearningContext'],
  },
  {
    id: 'rates-and-stocks', scope: 'GENERAL_FINANCE',
    text: 'Không phải lúc nào lãi suất tăng cũng làm cổ phiếu giảm. Chi phí vay cao hơn có thể gây sức ép lên lợi nhuận doanh nghiệp, và mức chiết khấu cao hơn có thể làm lợi nhuận tương lai đáng giá ít hơn hôm nay. Giá cổ phiếu còn phụ thuộc vào kỳ vọng lợi nhuận và việc thị trường đã dự đoán thay đổi lãi suất đến đâu.',
    references: ['https://www.federalreserve.gov/boarddocs/speeches/2003/20031002/default.htm'],
  },
  {
    id: 'stock-prices-exe', scope: 'EXE_RULE',
    text: 'Trong EXE, giá cổ phiếu thông thường biến động theo bối cảnh của vòng, theo ngành và theo từng mã. Cú sốc như “Tín dụng thắt chặt” áp dụng mức biến động định sẵn cho từng ngành. Engine không lấy mức tăng lãi suất làm công thức khiến cổ phiếu luôn giảm.',
    references: ['src/game/market.ts#updateNormalMarket', 'src/game/market.ts#applyMacroShock', 'src/data/config.ts#MACRO_EVENTS'],
  },
]
