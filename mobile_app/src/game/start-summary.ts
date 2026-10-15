import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { RULES } from '../../../src/data/config.ts'
import type { BondPayment, GameState } from '../../../src/game/types.ts'

export const cashTone = (amount: number) => amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'neutral'

// Prefer the immutable settlement endpoint, including when inspecting an older lap
// after a wallet sale, funding action or later payment has changed current claims.
function startEndpoint(game: GameState, lap: number) {
  return game.log.findLast(entry => entry.kind === 'settlement' && entry.decisionId === 'settle-lap' && entry.after.lap === lap)?.after
    ?? (game.lap === lap ? game : null)
}

export function buildBondStartSummary(game: GameState, lap: number) {
  const end = startEndpoint(game, lap)
  if (end?.bondRulesVersion !== 'v2.5-credit-risk') return []
  return BOND_ISSUERS.flatMap(issuer => {
    const lots = end.bondLots.filter(lot => lot.credit?.issuerId === issuer.id).flatMap(lot => {
      const credit = lot.credit!
      const history = credit.history.filter(payment => payment.lap === lap)
      if (!history.length && !(lot.status === 'active' && lot.principal > 0)
        && credit.outstandingCoupon + credit.outstandingPrincipal === 0) return []
      const sum = (key: keyof Omit<BondPayment, 'lap' | 'status'>) => history.reduce((total, payment) => total + payment[key], 0)
      const previous = credit.history.findLast(payment => payment.lap < lap)
      return [{ id: lot.id, issuerName: issuer.name, couponDue: sum('couponDue'), couponPaid: sum('couponPaid'),
        principalDue: sum('principalDue'), principalPaid: sum('principalPaid'),
        outstandingCoupon: credit.outstandingCoupon, outstandingPrincipal: credit.outstandingPrincipal,
        principalLost: credit.principalLost, couponLost: credit.couponLost,
        newLoss: sum('principalLost') + sum('couponLost'), status: credit.paymentStatus,
        cured: previous?.status === 'delayed' && sum('couponPaid') + sum('principalPaid') > 0,
        history: history.map(payment => ({ ...payment })) }]
    })
    if (!lots.length) return []
    const sum = (key: 'couponDue' | 'couponPaid' | 'principalDue' | 'principalPaid' | 'outstandingCoupon' | 'outstandingPrincipal' | 'principalLost' | 'couponLost' | 'newLoss') => lots.reduce((total, lot) => total + lot[key], 0)
    const totals = { couponDue: sum('couponDue'), couponPaid: sum('couponPaid'), principalDue: sum('principalDue'), principalPaid: sum('principalPaid'),
      outstandingCoupon: sum('outstandingCoupon'), outstandingPrincipal: sum('outstandingPrincipal'),
      principalLost: sum('principalLost'), couponLost: sum('couponLost'), newLoss: sum('newLoss') }
    const status = totals.principalLost + totals.couponLost > 0 ? 'loss'
      : totals.outstandingCoupon + totals.outstandingPrincipal > 0 ? 'delayed'
        : lots.some(lot => lot.cured) ? 'cured'
          : totals.couponPaid + totals.principalPaid > 0 ? 'paid' : 'holding'
    return [{ id: issuer.id, name: issuer.name, ...totals, status, lots }]
  })
}

export type BondStartSummary = ReturnType<typeof buildBondStartSummary>[number]

export function buildStartOverview(game: GameState, lap: number) {
  const endIndex = game.log.findLastIndex(entry => entry.kind === 'settlement' && entry.decisionId === 'settle-lap' && entry.after.lap === lap)
  if (endIndex < 0) return null
  // The unchanged engine records five ordered financial schedules after market
  // updating. Funding records can appear between them; exclude wallet/turn trades.
  const schedules = game.log.slice(0, endIndex).filter(entry => entry.kind === 'schedule' && entry.after.lap === lap).slice(-5)
  if (schedules.length !== 5) return null
  const startIndex = game.log.indexOf(schedules[0])
  const records = game.log.slice(startIndex, endIndex + 1)
  const end = game.log[endIndex].after, before = schedules[0].before
  const funding = records.filter(entry => entry.kind === 'funding')
  const fundingReceived = funding.reduce((total, entry) => total + entry.cashProceeds, 0)
  const received = schedules.reduce((total, entry) => total + Math.max(0, entry.cashDelta), 0) + fundingReceived
  const paid = schedules.reduce((total, entry) => total + Math.max(0, -entry.cashDelta), 0)
    + funding.reduce((total, entry) => total + entry.expensePaid, 0)
  if (received - paid !== end.portfolio.cash - before.portfolio.cash) return null
  const maturity = schedules[2]
  const savingsReceived = maturity.after.deposits.filter(lot => lot.status === 'matured'
    && maturity.before.deposits.some(prior => prior.id === lot.id && prior.status === 'active'))
    .reduce((total, lot) => total + lot.principal + lot.earnedInterest, 0)
  const bondReceived = end.bondRulesVersion === 'v2.5-credit-risk'
    ? buildBondStartSummary(game, lap).reduce((total, issuer) => total + issuer.couponPaid + issuer.principalPaid, 0)
    : maturity.cashDelta - savingsReceived
  const businessFunding = records.slice(records.indexOf(schedules[1]), records.indexOf(maturity))
    .filter(entry => entry.kind === 'funding').reduce((total, entry) => total + entry.expensePaid, 0)
  return { salary: Math.min(schedules[0].cashDelta, RULES.recurringIncome),
    courseIncrease: Math.max(0, schedules[0].cashDelta - RULES.recurringIncome),
    businessCash: schedules[1].cashDelta - businessFunding, businessRelevant: before.business.capital > 0,
    savingsReceived, bondReceived, fundingReceived, received, paid,
    cashBefore: before.portfolio.cash, cashAfter: end.portfolio.cash, debtAfter: end.portfolio.debt }
}
