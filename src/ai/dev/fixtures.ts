import {
  advance,
  canChoose,
  createGame,
  decide,
  fundPayment,
  roll,
  transact,
} from '../../game/engine.ts'
import { borrowingAvailable, fundingSources } from '../../game/transactions.ts'
import { ECONOMY } from '../../data/config.ts'
import { EVENTS } from '../../data/events.ts'
import type { GameState } from '../../game/types.ts'
import type { CoachOutput } from '../types.ts'

const baseGame = createGame('demo-preview-seed', 0, 1, 'experimental-b')

/** Kịch bản 1: THẮNG (Đạt 98.000.000 VND nguồn huy động) */
export const winFixture: GameState = {
  ...baseGame,
  phase: 'finished',
  lap: 4,
  turn: 24,
  termination: 'completed',
  coursePurchased: true,
  portfolio: {
    ...baseGame.portfolio,
    cash: 98_000_000,
    savings: 0,
    stocks: 0,
    bonds: 0,
    gold: 0,
    business: 0,
    debt: 0,
  },
  deposits: [
    {
      id: 'dep-matured-1',
      principal: 20_000_000,
      startLap: 1,
      maturityLap: 3,
      rate: 0.06,
      status: 'matured',
      earnedInterest: 3_600_000,
    },
  ],
}

/** Kịch bản 2: THUA DO KẸT VỐN KINH DOANH (Net Worth 115M > 90M, nhưng tiền huy động chỉ 55M) */
export const lockedBusinessLossFixture: GameState = {
  ...baseGame,
  phase: 'finished',
  lap: 4,
  turn: 25,
  termination: 'completed',
  portfolio: {
    ...baseGame.portfolio,
    cash: 55_000_000,
    business: 60_000_000,
    savings: 0,
    stocks: 0,
    bonds: 0,
    gold: 0,
    debt: 0,
  },
  business: {
    ...baseGame.business,
    capital: 60_000_000,
    upgrades: { taste: 2, budget: 1 },
  },
}

/** Kịch bản 3: RÚT TIẾT KIỆM TRƯỚC HẠN (Mất lãi 5.400.000 VND) */
export const earlyWithdrawalFixture: GameState = {
  ...baseGame,
  phase: 'finished',
  lap: 4,
  turn: 23,
  termination: 'completed',
  portfolio: {
    ...baseGame.portfolio,
    cash: 72_000_000,
    savings: 0,
    stocks: 0,
    bonds: 0,
    gold: 0,
    business: 0,
    debt: 0,
  },
  deposits: [
    {
      id: 'dep-withdrawn-1',
      principal: 30_000_000,
      startLap: 1,
      maturityLap: 3,
      rate: 0.06,
      status: 'withdrawn',
      earnedInterest: 0,
    },
  ],
  log: [
    {
      sequence: 10,
      kind: 'funding',
      lap: 2,
      turn: 12,
      tileId: 5,
      title: 'Huy động tiền khẩn cấp',
      decision: 'Rút sổ tiết kiệm 30M',
      consequence: 'Mất lãi 5.400.000 VND',
      cashDelta: 30_000_000,
      savingsDelta: -30_000_000,
      stockDelta: 0,
      bondDelta: 0,
      goldDelta: 0,
      businessDelta: 0,
      debtDelta: 0,
      recurringIncomeDelta: 0,
      forcedWithdrawalAmount: 30_000_000,
      lostSavingsInterest: 5_400_000,
      forcedAssetSaleAmount: 0,
      assetSaleAmounts: { stocks: 0, bonds: 0, gold: 0 },
      obligationCreated: 0,
      cashProceeds: 30_000_000,
      expensePaid: 0,
      debtInterestPaid: 0,
      debtInterestAccrued: 0,
      before: baseGame,
      after: baseGame,
    },
  ],
}

/** Kịch bản 4: PHÁ SẢN (Insolvent vì cạn kiệt thanh khoản và nợ) */
export const insolventFixture: GameState = {
  ...baseGame,
  phase: 'finished',
  lap: 3,
  turn: 16,
  termination: 'insolvent',
  portfolio: {
    ...baseGame.portfolio,
    cash: 500_000,
    debt: 20_000_000,
    savings: 0,
    stocks: 0,
    bonds: 0,
    gold: 0,
    business: 0,
  },
  log: [
    {
      sequence: 15,
      kind: 'settlement',
      lap: 3,
      turn: 15,
      tileId: 0,
      title: 'Trả lãi nợ',
      decision: 'Thanh toán lãi',
      consequence: 'Trừ lãi',
      cashDelta: -2_000_000,
      savingsDelta: 0,
      stockDelta: 0,
      bondDelta: 0,
      goldDelta: 0,
      businessDelta: 0,
      debtDelta: 0,
      recurringIncomeDelta: 0,
      forcedWithdrawalAmount: 0,
      lostSavingsInterest: 0,
      forcedAssetSaleAmount: 0,
      assetSaleAmounts: { stocks: 0, bonds: 0, gold: 0 },
      obligationCreated: 0,
      cashProceeds: 0,
      expensePaid: 0,
      debtInterestPaid: 2_000_000,
      debtInterestAccrued: 0,
      before: baseGame,
      after: baseGame,
    },
  ],
}

/**
 * Sinh một ván chơi thật ngẫu nhiên từ Engine (chạy seeded gameplay từ vòng 1 đến khi kết thúc).
 * Đảm bảo 100% dữ liệu, nhật ký, số tiền là kết quả thật từ engine mà không cần chơi thủ công 20 phút.
 */
export function generateLiveGame(
  strategy: 'saving-heavy' | 'business-heavy' | 'diversified' = 'diversified',
  seed = `seed-${Date.now().toString(36)}`
): GameState {
  const startSavings = strategy === 'saving-heavy' ? 25_000_000 : strategy === 'diversified' ? 10_000_000 : 0
  let s = createGame(seed, startSavings, 1, 'experimental-b')
  let steps = 0

  while (s.phase !== 'finished' && steps++ < 300) {
    if (s.phase === 'rolling') {
      s = roll(s)
    } else if (s.phase === 'event') {
      const budget = Math.max(0, s.portfolio.cash - 10_000_000)
      const id = s.eventId

      if (id === 'bank' && budget >= 5_000_000 && strategy === 'saving-heavy') {
        s = transact(s, { kind: 'deposit', amount: 5_000_000, term: 1 })
      } else if (id === 'stocks' && budget >= 5_000_000 && s.market.stocks.length > 0) {
        s = transact(s, {
          kind: 'buy',
          asset: 'stocks',
          amount: 5_000_000,
          symbolId: s.market.stocks[0].id,
        })
      } else if (id === 'business' && budget >= ECONOMY.business.cost && s.business.capital === 0 && s.lap < 4) {
        s = transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
      } else if (id === 'business' && s.business.capital > 0 && s.lap === 4) {
        s = transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
      }

      const event = EVENTS.find(e => e.id === s.eventId)
      if (event) {
        const preferred = event.id === 'course' && s.lap <= 2 && canChoose(s, 'upgrade')
          ? 'upgrade'
          : event.options.find(opt => canChoose(s, opt.id))?.id || event.options[0].id
        s = decide(s, preferred)
      } else {
        s = advance(s)
      }
    } else if (s.phase === 'funding') {
      const source = fundingSources(s)[0]
      if (!source) break
      const lot = s.deposits.find(l => l.status === 'active')
      const amount = source === 'savings'
        ? lot?.principal ?? 0
        : source === 'debt'
          ? Math.min(s.pendingPayment?.remaining ?? 0, borrowingAvailable(s))
          : s.portfolio[source]
      s = fundPayment(s, source, amount, source === 'savings' ? lot?.id : undefined)
    } else {
      s = advance(s)
    }
  }

  // Đảm bảo kết thúc ván
  if (s.phase !== 'finished') {
    s = { ...s, phase: 'finished', termination: s.termination || 'completed' }
  }

  return s
}

/** Dữ liệu phản hồi AI mẫu (Mock Output) chuẩn schema cho từng kịch bản */
export const mockOutputs: Record<string, CoachOutput> = {
  win: {
    version: 1,
    headline: 'Chiến lược tích lũy kỷ luật và tối ưu thu nhập định kỳ xuất sắc.',
    insights: [
      {
        title: 'Chạm đích thành công',
        explanation: 'Bạn đã hoàn tất hành trình với 98.000.000 VND nguồn tiền hợp lệ, vượt xa ngưỡng 90 triệu yêu cầu.',
        evidenceIds: ['ev:goal-achieved'],
      },
      {
        title: 'Đầu tư bản thân mang lại hiệu quả cao',
        explanation: 'Khóa học phát triển bản thân giúp tăng lương 3 triệu qua mỗi vòng, tạo dòng tiền dồi dào để về đích an toàn.',
        evidenceIds: ['ev:course-purchased'],
      },
      {
        title: 'Tiết kiệm sinh lời đúng hạn',
        explanation: 'Các khoản tiền gửi đáo hạn đúng kế hoạch đóng góp 3.600.000 VND tiền lãi thực nhận vào ngân sách cuối ván.',
        evidenceIds: ['ev:savings-matured-interest'],
      },
    ],
    tryNext: 'Ở ván sau, hãy thử nghiệm phân bổ thêm một phần vốn vào cổ phiếu hoặc vàng tại các vòng đầu để xem biên độ sinh lời.',
  },
  locked: {
    version: 1,
    headline: 'Tài sản ròng lớn nhưng thiếu thanh khoản để hoàn thành mục tiêu.',
    insights: [
      {
        title: 'Vốn kẹt trong cơ sở kinh doanh',
        explanation: 'Bạn có 60.000.000 VND vốn kinh doanh chưa thanh lý; theo luật game, cơ sở kinh doanh không thể bán tại vạch đích.',
        evidenceIds: ['ev:business-locked'],
      },
      {
        title: 'Chênh lệch thanh khoản then chốt',
        explanation: 'Tổng tài sản ròng đạt 115 triệu (vượt 90 triệu) nhưng nguồn tiền huy động thực tế chỉ đạt 55 triệu do vốn bị khóa.',
        evidenceIds: ['ev:liquidity-gap', 'ev:goal-missed'],
      },
      {
        title: 'Đầu tư nâng cấp nhưng chưa kịp thu hồi',
        explanation: 'Các lượt nâng cấp giúp tăng doanh thu nhưng nếu không chủ động bán ở ô Kinh doanh trước vòng 4, vốn sẽ không được tính.',
        evidenceIds: ['ev:business-upgraded'],
      },
    ],
    tryNext: 'Thử nghiệm bán cơ sở kinh doanh tại ô Kinh doanh ở vòng 3 hoặc đầu vòng 4 để kịp chuyển đổi thành tiền mặt trước khi về đích.',
  },
  withdraw: {
    version: 1,
    headline: 'Rút vốn trước hạn làm mất đi đòn bẩy lãi suất tích lũy.',
    insights: [
      {
        title: 'Chi phí cơ hội từ việc rút tiết kiệm sớm',
        explanation: 'Việc rút sổ tiết kiệm khẩn cấp làm mất 5.400.000 VND tiền lãi chưa nhận, làm giảm đáng kể nguồn tiền huy động.',
        evidenceIds: ['ev:savings-early-withdrawal'],
      },
      {
        title: 'Chưa đạt mục tiêu do thiếu hụt dòng tiền',
        explanation: 'Nguồn tiền cuối ván đạt 72 triệu, còn thiếu 18 triệu so với mốc 90 triệu.',
        evidenceIds: ['ev:goal-missed'],
      },
    ],
    tryNext: 'Hãy cân nhắc giữ một khoản tiền mặt dự phòng lớn hơn ở đầu ván để tránh phải phá vỡ các hợp đồng tiết kiệm dài hạn.',
  },
  insolvent: {
    version: 1,
    headline: 'Gánh nặng nợ vay và chi phí lãi làm cạn kiệt thanh khoản.',
    insights: [
      {
        title: 'Mất khả năng thanh toán ở vòng 3',
        explanation: 'Tiền mặt cạn kiệt và hết hạn mức vay khi gặp các nghĩa vụ thanh toán định kỳ dẫn đến vỡ nợ.',
        evidenceIds: ['ev:insolvent-finish'],
      },
      {
        title: 'Áp lực từ nợ vay và chi phí lãi',
        explanation: 'Khoản nợ 20 triệu kèm chi phí lãi phát sinh bào mòn dòng tiền của bạn qua từng vòng.',
        evidenceIds: ['ev:outstanding-debt', 'ev:debt-interest-paid'],
      },
    ],
    tryNext: 'Thử hạn chế vay nợ tối đa và ưu tiên gửi tiết kiệm kỳ hạn ngắn 1 vòng để luôn có dòng tiền đáo hạn ứng cứu kịp thời.',
  },
}
