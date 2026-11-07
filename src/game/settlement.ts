import { collectPayment, resolveInsolvency } from './transactions.ts'
import { copyState, record, snapshot } from './state.ts'
import { totalWorth } from './selectors.ts'
import { syncValuations, updateNormalMarket } from './market.ts'
import { businessIncome } from './business.ts'
import { ECONOMY } from '../data/config.ts'
import type { Asset, GameState } from './types.ts'
import { hasBondCredit, settleCreditBonds } from './bond-credit.ts'
import { hasPeriodicLiving, livingCostForGame } from './living-expenses.ts'
import { rulesForGame } from './rules-profile.ts'

export function beginSettlement(state: GameState): GameState {
  if (state.termination || state.settlement || state.summaries.some(summary => summary.lap === state.lap)) return state
  const s = copyState(state)
  s.eventId = null
  s.settlement = { step: 0, before: snapshot(state), lines: [], rates: {}, incomeTotal: state.recurringIncome, debtPrincipalPaid: 0, fundingNotes: [] }
  return continueSettlement(s)
}

// Advance the cursor before any payment pause; reentry cannot pay salary or schedules twice.
export function continueSettlement(state: GameState): GameState {
  if (!state.settlement || state.pendingPayment || state.termination) return state
  let s = copyState(state)
  const periodic = hasPeriodicLiving(s)
  const debtStep = periodic ? 5 : 4
  const scheduleTitles = periodic
    ? ['Thị trường', 'Nhận lương', 'Dòng tiền kinh doanh', 'Đáo hạn và coupon', 'Chi phí sinh hoạt', 'Nợ đến hạn', 'Nghĩa vụ đến hạn']
    : ['Thị trường', 'Nhận lương', 'Dòng tiền kinh doanh', 'Đáo hạn và coupon', 'Nợ đến hạn', 'Nghĩa vụ đến hạn']
  while (s.settlement!.step < scheduleTitles.length) {
    const before = snapshot(s)
    const step = s.settlement!.step++
    let livingPaid = 0
    if (step === 0) {
      s = updateNormalMarket(s)
      const progress = s.settlement!
      const prior = progress.before.portfolio
      for (const asset of ['stocks', 'bonds', 'gold', 'business'] as Asset[]) {
        progress.rates[asset] = prior[asset] > 0 ? s.portfolio[asset] / prior[asset] - 1 : 0
      }
    } else if (step === 1) {
      s.portfolio.cash += s.recurringIncome
      s.settlement!.lines.push({ label: 'Lương cơ bản tại START', amount: rulesForGame(s).recurringIncome },
        { label: 'Tăng lương từ khóa học', amount: s.recurringIncome - rulesForGame(s).recurringIncome })
    } else if (step === 2) {
      const income = businessIncome(s)
      s.settlement!.lines.push({ label: 'Dòng tiền kinh doanh', amount: income })
      if (income >= 0) s.portfolio.cash += income
      else collectPayment(s, { origin: 'settlement', title: 'Lỗ vận hành kinh doanh', total: -income })
    } else if (step === 3) {
      for (const lot of s.deposits) {
        if (lot.status !== 'active' || lot.maturityLap > s.lap) continue
        lot.earnedInterest = Math.round(lot.principal * lot.rate * (lot.maturityLap - lot.startLap + 1))
        lot.status = 'matured'; s.portfolio.cash += lot.principal + lot.earnedInterest
        s.settlement!.lines.push({ label: `Đáo hạn ${lot.id} (gốc + lãi)`, amount: lot.principal + lot.earnedInterest })
      }
      if (hasBondCredit(s)) s.settlement!.lines.push(...settleCreditBonds(s))
      else for (const lot of s.bondLots) {
        if (lot.status !== 'active') continue
        if (lot.lastCouponLap < s.lap) {
          const coupon = Math.round(lot.principal * ECONOMY.bond.coupon)
          s.portfolio.cash += coupon; lot.lastCouponLap = s.lap
          s.settlement!.lines.push({ label: `Coupon ${lot.id}`, amount: coupon })
        }
        if (lot.maturityLap <= s.lap) {
          const principal = Math.round(lot.principal)
          s.portfolio.cash += principal; lot.status = 'matured'
          s.settlement!.lines.push({ label: `Hoàn gốc ${lot.id}`, amount: principal })
        }
      }
      s.savingsMatured = !s.deposits.some(lot => lot.status === 'active')
      syncValuations(s)
    } else if (periodic && step === 4) {
      s.settlement!.lines.push({ label: 'Chi phí sinh hoạt', amount: -livingCostForGame(s) })
      livingPaid = collectPayment(s, { origin: 'settlement', title: 'Chi phí sinh hoạt', total: livingCostForGame(s) })
    } else if (step === debtStep) {
      const principal = s.settlement!.before.portfolio.debt
      const interest = Math.round(principal * rulesForGame(s).debtRate)
      s.portfolio.debt -= principal; s.settlement!.debtPrincipalPaid = principal
      s.settlement!.lines.push({ label: 'Gốc nợ và lãi đến hạn', amount: -(principal + interest) })
      collectPayment(s, { origin: 'settlement', title: 'Gốc nợ và lãi vay', total: principal + interest })
    } else {
      const obligations = s.obligations
      s.obligations = 0
      s.settlement!.lines.push({ label: 'Nghĩa vụ đã hẹn', amount: -obligations })
      collectPayment(s, { origin: 'settlement', title: 'Nghĩa vụ đã hẹn', total: obligations })
    }
    if (step > 0) s = record(s, before, { kind: 'schedule', title: scheduleTitles[step],
      decision: `Bước quyết toán ${step + 1}`, consequence: 'Đã xử lý một lần; snapshot lưu toàn bộ khoản gửi, báo giá, sở hữu và nợ.',
      ...(periodic && step === 4 ? { expensePaid: livingPaid } : {}),
      debtInterestPaid: step === debtStep ? Math.round(s.settlement!.before.portfolio.debt * rulesForGame(s).debtRate) : 0 })
    if (s.pendingPayment) return resolveInsolvency(s)
  }
  const progress = s.settlement!
  const finalBefore = snapshot(s)
  const terminalInterest = s.lap === s.totalLaps ? Math.round(s.portfolio.debt * rulesForGame(s).debtRate) : 0
  if (terminalInterest > 0) {
    s.portfolio.debt += terminalInterest
    progress.lines.push({ label: 'Lãi khoản vay mới tại START cuối', amount: -terminalInterest })
    progress.fundingNotes.push('Lãi vay mới tại START cuối được cộng vào nợ, trừ khỏi nguồn huy động hợp lệ.')
  }
  s.phase = 'summary'; s.pendingCost = 0
  s.summaries = [...s.summaries, { lap: s.lap, before: totalWorth(progress.before), after: totalWorth(s),
    lines: progress.lines, rates: progress.rates as Record<Asset, number>, incomeTotal: progress.incomeTotal,
    debtPrincipalPaid: progress.debtPrincipalPaid, fundingNotes: progress.fundingNotes }]
  s.settlement = null
  return record(s, finalBefore, { kind: 'settlement', title: `Quyết toán vòng ${s.lap}`, decision: 'Hoàn thành quyết toán', decisionId: 'settle-lap',
    consequence: periodic
      ? 'Thị trường → lương → kinh doanh → đáo hạn/coupon → sinh hoạt → nợ/nghĩa vụ. Tiếp theo: quyền bán tại START, kể cả vòng cuối.'
      : 'Thị trường → lương → kinh doanh → đáo hạn/coupon → nợ/nghĩa vụ. Tiếp theo: quyền bán tại START, kể cả vòng cuối.',
    debtInterestAccrued: terminalInterest })
}
