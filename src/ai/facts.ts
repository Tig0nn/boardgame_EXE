import { RULES } from '../data/config.ts'
import { liquidatableFunds, totalWorth, victory } from '../game/selectors.ts'
import type { GameState } from '../game/types.ts'
import type { CoachEvidence, CoachFacts } from './types.ts'
import { bondCreditFacts } from '../game/bond-credit.ts'

function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} VND`
}

/**
 * Xây dựng tập Facts và Evidences cô đọng (< 10 KB) từ GameState kết thúc.
 * Chỉ gọi khi game.phase === 'finished'.
 * Sử dụng selector chuẩn của engine, tuyệt đối không tính toán lại số liệu tài chính.
 */
export function buildCoachFacts(game: GameState): CoachFacts {
  if (game.phase !== 'finished') {
    throw new Error('Chỉ có thể tạo AI Coach facts khi ván chơi đã kết thúc (game.phase === "finished").')
  }

  const vic = victory(game)
  const won = vic.won
  const insolvent = game.termination === 'insolvent'
  const lawfulProceeds = liquidatableFunds(game)
  const netWorth = totalWorth(game)
  const goalCost = RULES.goal
  const requiredReserve = RULES.cashGoal
  const targetProceeds = goalCost + requiredReserve
  const businessLockedQuote = game.portfolio.business

  const candidateEvidences: Array<{ priority: number; evidence: CoachEvidence }> = []
  for (const issuer of bondCreditFacts(game)) {
    candidateEvidences.push({ priority: 2, evidence: { id: `ev:bond-${issuer.id}-cash`, kind: 'bond-credit',
      fact: `${issuer.name}: coupon thực nhận ${formatVnd(issuer.couponPaid)}, gốc đã nhận/thu hồi ${formatVnd(issuer.principalPaid)}. Chậm coupon ${issuer.couponDelayed} kỳ, chậm gốc ${issuer.principalDelayed} kỳ. Còn chờ coupon ${formatVnd(issuer.outstandingCoupon)}, gốc ${formatVnd(issuer.outstandingPrincipal)}. Mất gốc ${formatVnd(issuer.principalLost)}, coupon ${formatVnd(issuer.couponLost)}.` } },
    { priority: 2.5, evidence: { id: `ev:bond-${issuer.id}-choice`, kind: 'bond-choice', lap: issuer.firstPurchaseLap,
      fact: `${issuer.name}: đã mua ${formatVnd(issuer.bought)}, ${issuer.concentration}% tiền mua Bond. Tín hiệu lúc mua đầu tiên: ${issuer.warning} Bán ở vòng ${issuer.saleLaps.join(', ') || 'chưa bán'}, thực nhận ${formatVnd(issuer.netSold)}.` } })
  }

  // 1. Kết quả chung & vỡ nợ (Priority 1)
  if (insolvent) {
    candidateEvidences.push({
      priority: 1,
      evidence: {
        id: 'ev:insolvent-finish',
        kind: 'insolvency',
        lap: game.lap,
        turn: game.turn,
        fact: `Mất khả năng thanh toán (phá sản) ở vòng ${game.lap}, cạn kiệt thanh khoản và hạn mức vay khi gặp nghĩa vụ chi trả.`,
      },
    })
  } else if (won) {
    candidateEvidences.push({
      priority: 1,
      evidence: {
        id: 'ev:goal-achieved',
        kind: 'goal-result',
        lap: game.lap,
        fact: `Đạt mục tiêu thành công với ${formatVnd(lawfulProceeds)} nguồn tiền huy động hợp lệ (vượt mốc tối thiểu ${formatVnd(targetProceeds)}).`,
      },
    })
  } else {
    const gap = targetProceeds - lawfulProceeds
    candidateEvidences.push({
      priority: 1,
      evidence: {
        id: 'ev:goal-missed',
        kind: 'goal-result',
        lap: game.lap,
        fact: `Chưa đạt mục tiêu 90 triệu huy động hợp lệ; nguồn tiền cuối ván là ${formatVnd(lawfulProceeds)} (còn thiếu ${formatVnd(gap)}).`,
      },
    })
  }

  // 2. Chênh lệch thanh khoản & Kinh doanh chưa bán (Priority 2)
  if (businessLockedQuote > 0) {
    candidateEvidences.push({
      priority: 2,
      evidence: {
        id: 'ev:business-locked',
        kind: 'business-locked',
        lap: game.lap,
        fact: `Vốn kinh doanh ${formatVnd(businessLockedQuote)} chưa thanh lý ở cuối ván; theo luật, cơ sở kinh doanh không thể bán tại đích và không được tính vào nguồn tiền huy động hợp lệ.`,
      },
    })

    if (netWorth >= targetProceeds && !won) {
      candidateEvidences.push({
        priority: 2,
        evidence: {
          id: 'ev:liquidity-gap',
          kind: 'liquidity-gap',
          lap: game.lap,
          fact: `Tổng tài sản ròng đạt ${formatVnd(netWorth)} (vượt 90 triệu) nhưng không thể chiến thắng do thiếu thanh khoản hợp lệ từ vốn kẹt trong kinh doanh.`,
        },
      })
    }
  }

  // 3. Rút tiết kiệm trước hạn mất lãi (Priority 3)
  const totalLostInterest = game.log.reduce((sum, entry) => sum + (entry.lostSavingsInterest ?? 0), 0)
  const earlyWithdrawals = game.deposits.filter(d => d.status === 'withdrawn')
  if (totalLostInterest > 0 || earlyWithdrawals.length > 0) {
    candidateEvidences.push({
      priority: 3,
      evidence: {
        id: 'ev:savings-early-withdrawal',
        kind: 'savings-withdrawal',
        fact: `Đã rút tiết kiệm trước hạn (mất ${formatVnd(totalLostInterest)} tiền lãi kỳ hạn chưa nhận).`,
      },
    })
  }

  // 4. Vay nợ & áp lực lãi vay (Priority 4)
  const totalDebtInterestPaid = game.log.reduce((sum, entry) => sum + (entry.debtInterestPaid ?? 0), 0)
  if (game.portfolio.debt > 0) {
    candidateEvidences.push({
      priority: 4,
      evidence: {
        id: 'ev:outstanding-debt',
        kind: 'borrowing',
        lap: game.lap,
        fact: `Còn khoản nợ ${formatVnd(game.portfolio.debt)} chưa thanh toán ở cuối ván, bị khấu trừ trực tiếp khỏi nguồn tiền huy động.`,
      },
    })
  }
  if (totalDebtInterestPaid > 0) {
    candidateEvidences.push({
      priority: 4,
      evidence: {
        id: 'ev:debt-interest-paid',
        kind: 'borrowing',
        fact: `Đã chi trả tổng cộng ${formatVnd(totalDebtInterestPaid)} tiền lãi vay phát sinh trong hành trình.`,
      },
    })
  }

  // 5. Khóa học nâng cao năng lực bản thân (Priority 5)
  if (game.coursePurchased) {
    const courseEntry = game.log.find(e => e.kind === 'decision' && e.consequence?.includes('tăng lương'))
    const lapBought = courseEntry?.lap ?? 1
    candidateEvidences.push({
      priority: 5,
      evidence: {
        id: 'ev:course-purchased',
        kind: 'course',
        lap: lapBought,
        fact: `Đã đầu tư khóa học nâng cao năng lực bản thân ở vòng ${lapBought} (chi phí 6.000.000 VND), giúp tăng lương định kỳ thêm 3.000.000 VND mỗi lần qua START.`,
      },
    })
  } else {
    candidateEvidences.push({
      priority: 6,
      evidence: {
        id: 'ev:course-not-purchased',
        kind: 'course',
        fact: 'Không đầu tư khóa học nâng cao năng lực bản thân, giữ nguyên mức lương cơ bản 14.000.000 VND qua các vòng.',
      },
    })
  }

  // 6. Kinh doanh: Nâng cấp hoặc Bán (Priority 6)
  const upgradeLevels = Object.values(game.business?.upgrades ?? {}).reduce((sum, lvl) => sum + lvl, 0)
  if (upgradeLevels > 0) {
    candidateEvidences.push({
      priority: 6,
      evidence: {
        id: 'ev:business-upgraded',
        kind: 'business-upgrade',
        fact: `Đã thực hiện nâng cấp cơ sở kinh doanh ${upgradeLevels} lần để gia tăng dòng tiền hoạt động theo thị hiếu khách hàng.`,
      },
    })
  }
  const businessSaleEntry = game.log.find(e => e.kind === 'rebalancing' && (e.businessDelta ?? 0) < 0)
  if (businessSaleEntry) {
    candidateEvidences.push({
      priority: 6,
      evidence: {
        id: 'ev:business-sold',
        kind: 'business-sale',
        lap: businessSaleEntry.lap,
        fact: `Đã bán cơ sở kinh doanh ở vòng ${businessSaleEntry.lap} thu về ${formatVnd(businessSaleEntry.cashProceeds ?? 0)} thanh khoản hợp lệ.`,
      },
    })
  }

  // 7. Tiết kiệm đáo hạn (Priority 7)
  const totalMaturedInterest = game.deposits
    .filter(d => d.status === 'matured')
    .reduce((sum, d) => sum + (d.earnedInterest ?? 0), 0)
  if (totalMaturedInterest > 0) {
    candidateEvidences.push({
      priority: 7,
      evidence: {
        id: 'ev:savings-matured-interest',
        kind: 'savings-maturity',
        fact: `Tiết kiệm tích lũy đã đáo hạn đúng kế hoạch, thu về tổng cộng ${formatVnd(totalMaturedInterest)} tiền lãi thực nhận.`,
      },
    })
  }

  // 8. Tài sản tài chính (Cổ phiếu, Vàng, Trái phiếu) & Biến cố vĩ mô (Priority 8)
  const tradableWorth = game.portfolio.stocks + game.portfolio.gold + game.portfolio.bonds
  if (tradableWorth > 0) {
    candidateEvidences.push({
      priority: 8,
      evidence: {
        id: 'ev:financial-portfolio',
        kind: 'asset-trade',
        fact: `Nắm giữ danh mục tài sản tài chính (cổ phiếu, trái phiếu, vàng) có giá trị định giá ròng ${formatVnd(tradableWorth)}.`,
      },
    })
  }
  if ((game.market?.appliedShocks?.length ?? 0) > 0) {
    candidateEvidences.push({
      priority: 8,
      evidence: {
        id: 'ev:macro-shocks-applied',
        kind: 'macro-shock',
        fact: `Đã trải qua ${game.market.appliedShocks.length} cú sốc thị trường vĩ mô tác động trực tiếp lên giá tài sản.`,
      },
    })
  }

  // Sắp xếp theo mức độ ưu tiên và cắt tỉa tối đa 8 bằng chứng
  candidateEvidences.sort((a, b) => a.priority - b.priority)
  const curatedEvidence = candidateEvidences.slice(0, 8).map(item => item.evidence)

  return {
    version: 1,
    mode: game.gameMode,
    board: game.boardLayout,
    totalLaps: game.totalLaps,
    completed: true,
    won,
    insolvent,
    goalCostVnd: goalCost,
    requiredReserveVnd: requiredReserve,
    targetProceedsVnd: targetProceeds,
    lawfulProceedsVnd: lawfulProceeds,
    netWorthVnd: netWorth,
    cashVnd: game.portfolio.cash,
    debtVnd: game.portfolio.debt,
    obligationsVnd: game.obligations,
    businessLockedQuoteVnd: businessLockedQuote,
    savingsProfileId: game.savingsProfile?.id ?? 'v2.1-standard',
    evidence: curatedEvidence,
  }
}
