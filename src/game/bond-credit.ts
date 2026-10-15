import { BOND_ISSUERS, bondIssuer } from '../data/bond-issuers.ts'
import { ECONOMY } from '../data/config.ts'
import { hashSeed, random } from './random.ts'
import type { BondCreditMarket, BondIssuerId, BondIssuerState, BondLot, BondRulesVersion, GameState, Snapshot, SummaryLine } from './types.ts'

export function bondRulesForGame(s: { bondRulesVersion?: BondRulesVersion }): BondRulesVersion {
  const version = s.bondRulesVersion ?? 'v2.4-single-issuer'
  if (!['v2.4-single-issuer', 'v2.5-credit-risk'].includes(version)) throw new Error('Phiên bản luật trái phiếu không hợp lệ.')
  return version
}
export const hasBondCredit = (s: { bondRulesVersion?: BondRulesVersion }) => bondRulesForGame(s) === 'v2.5-credit-risk'
export function initializeBondCredit(seed: string): BondCreditMarket {
  return { rng: hashSeed(`${seed}:bond-credit-v2.5`), processedLaps: [], issuers: BOND_ISSUERS.map(issuer => ({
    id: issuer.id, status: 'performing', rating: issuer.rating, stress: 0, jitter: 0, defaultLap: null,
    currentPrice: issuer.faceValue, priceHistory: [], events: [],
  })) }
}
export function creditIssuer(s: Pick<Snapshot, 'bondCredit'>, id: BondIssuerId) {
  const issuer = s.bondCredit?.issuers.find(item => item.id === id)
  if (!issuer) throw new Error('Thiếu dữ liệu tín dụng của tổ chức phát hành.')
  return issuer
}
export function createCreditBondLot(s: GameState, issuerId: BondIssuerId | undefined, amount: number): BondLot {
  if (!issuerId) throw new Error('Hãy chọn tổ chức phát hành.')
  const config = bondIssuer(issuerId), issuer = creditIssuer(s, issuerId)
  if (issuer.status !== 'performing' || issuer.currentPrice <= 0) throw new Error('Tổ chức phát hành tạm ngừng bán trái phiếu mới.')
  const units = amount / issuer.currentPrice, principal = Math.round(units * config.faceValue)
  return { id: `bond-${s.bondLots.length + 1}`, units, principal, startLap: s.lap, maturityLap: s.lap + config.term - 1,
    lastCouponLap: s.lap - 1, status: 'active', credit: { issuerId, purchasePrice: issuer.currentPrice,
      costBasis: amount, originalFace: principal, couponRate: config.coupon, paymentStatus: issuer.status,
      outstandingCoupon: 0, outstandingPrincipal: 0, principalPaid: 0, principalLost: 0, couponLost: 0,
      soldPrincipal: 0, transferredCoupon: 0, lastProcessedLap: s.lap - 1, history: [],
      purchaseWarning: `Hạng ${issuer.rating} · Áp lực ${issuer.stress}/2 · ${config.riskLabel}. ${config.description}` } }
}
export function bondLotQuote(s: Pick<Snapshot, 'bondCredit' | 'bondLots'>, lotId: string, amount?: number) {
  const lot = s.bondLots.find(item => item.id === lotId)
  if (!lot?.credit) throw new Error('Khoản trái phiếu không hợp lệ.')
  const issuer = creditIssuer(s, lot.credit.issuerId)
  const executable = lot.status === 'active' && (issuer.status === 'performing' || issuer.status === 'delayed')
  const available = executable ? Math.round(lot.units * issuer.currentPrice) : 0
  const gross = amount ?? available
  if (!Number.isSafeInteger(gross) || gross < 0 || gross > available) throw new Error('Giá trị bán vượt khoản trái phiếu có thể bán.')
  const fee = Math.round(gross * ECONOMY.tradeFees.bonds)
  return { gross, fee, spread: 0, net: gross - fee, available, executable: executable && available > 0 }
}
export const creditBondLots = (s: Pick<Snapshot, 'bondCredit' | 'bondLots'>) => s.bondLots.filter(lot => lot.credit)
  .map(lot => ({ lot, quote: bondLotQuote(s, lot.id) }))

export function sellCreditBond(s: GameState, lotId: string | undefined, amount: number) {
  if (!lotId) throw new Error('Hãy chọn khoản trái phiếu muốn bán.')
  const quote = bondLotQuote(s, lotId, amount)
  if (!quote.executable || amount <= 0) throw new Error('Khoản trái phiếu không có báo giá bán khả dụng.')
  const lot = s.bondLots.find(item => item.id === lotId)!, credit = lot.credit!
  const fraction = amount / quote.available
  const principal = Math.round(lot.principal * fraction), coupon = Math.round(credit.outstandingCoupon * fraction)
  lot.units *= 1 - fraction; lot.principal -= principal
  credit.soldPrincipal += principal; credit.transferredCoupon += coupon
  credit.outstandingCoupon -= coupon
  credit.outstandingPrincipal -= Math.round(credit.outstandingPrincipal * fraction)
  credit.costBasis -= Math.round(credit.costBasis * fraction)
  if (fraction === 1) { lot.status = 'sold'; credit.paymentStatus = 'resolved' }
  return quote
}

export function creditProbabilities(s: Pick<Snapshot, 'scenarioId'>, issuer: BondIssuerState) {
  const config = bondIssuer(issuer.id)
  const penalty = (s.scenarioId === 'uncertain' ? config.uncertainPenalty : 0) + issuer.stress * config.stressPenalty
  const defaultRate = Math.min(1, (config.default + penalty) * (issuer.status === 'delayed' ? 2 : 1))
  return { defaultRate, delayRate: Math.min(1 - defaultRate, config.delay + penalty),
    cureRate: Math.min(1 - defaultRate, config.cure) }
}
function reprice(s: GameState, issuer: BondIssuerState, kind: 'normal' | 'shock', eventId?: string) {
  const config = bondIssuer(issuer.id), priceBefore = issuer.currentPrice
  const live = issuer.status === 'performing' || issuer.status === 'delayed'
  const factor = (issuer.status === 'delayed' ? config.distressedPrice : 1)
    - (s.scenarioId === 'uncertain' ? (issuer.id === 'an-tam' ? .01 : .03) : 0)
    - issuer.stress * (issuer.id === 'an-tam' ? .01 : .03) + issuer.jitter
  issuer.currentPrice = live ? Math.max(1, Math.round(config.faceValue * factor)) : 0
  issuer.priceHistory.push({ lap: s.lap, timestamp: s.turn, kind, ...(eventId ? { eventId } : {}),
    priceBefore, priceAfter: issuer.currentPrice, returnRate: priceBefore > 0 ? issuer.currentPrice / priceBefore - 1 : 0 })
}
// Mutates only a caller-owned copy. Fixed independent draws, even without holdings.
export function updateCreditMarket(s: GameState) {
  if (!hasBondCredit(s) || s.bondCredit!.processedLaps.includes(s.lap)) return
  const credit = s.bondCredit!
  const draw = () => { const next = random(credit.rng); credit.rng = next[1]; return next[0] }
  for (const issuer of credit.issuers) {
    const outcome = draw(), jitter = draw(), from = issuer.status
    const config = bondIssuer(issuer.id), risk = creditProbabilities(s, issuer)
    if (from === 'performing') issuer.status = outcome < risk.defaultRate ? 'defaulted'
      : outcome < risk.defaultRate + risk.delayRate ? 'delayed' : 'performing'
    else if (from === 'delayed') issuer.status = outcome < risk.defaultRate ? 'defaulted'
      : outcome < risk.defaultRate + risk.cureRate ? 'performing' : 'delayed'
    else if (from === 'defaulted' && issuer.defaultLap! < s.lap) issuer.status = 'resolved'
    if (issuer.status === 'defaulted' && from !== 'defaulted') issuer.defaultLap = s.lap
    issuer.jitter = (jitter * 2 - 1) * config.volatility
    issuer.rating = issuer.status === 'performing' ? config.rating : issuer.status === 'delayed' ? 'CCC' : 'D'
    issuer.events.push({ lap: s.lap, turn: s.turn, from, to: issuer.status, rating: issuer.rating, stress: issuer.stress })
    reprice(s, issuer, 'normal')
  }
  credit.processedLaps.push(s.lap)
}
export function applyCreditMacro(s: GameState, eventId: string) {
  if (!hasBondCredit(s)) return
  for (const issuer of s.bondCredit!.issuers) {
    issuer.stress = Math.max(0, Math.min(2, issuer.stress + (eventId === 'credit-tightening' ? 1 : -1)))
    reprice(s, issuer, 'shock', eventId)
  }
}

export function settleCreditBonds(s: GameState): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const lot of s.bondLots) {
    const credit = lot.credit
    if (!credit || lot.status !== 'active' || credit.lastProcessedLap >= s.lap) continue
    const issuer = creditIssuer(s, credit.issuerId), config = bondIssuer(credit.issuerId)
    credit.lastProcessedLap = s.lap
    const couponDue = s.lap <= lot.maturityLap && credit.paymentStatus !== 'defaulted' ? Math.round(lot.principal * credit.couponRate) : 0
    const principalDue = s.lap >= lot.maturityLap && credit.outstandingPrincipal === 0 && credit.paymentStatus !== 'defaulted' ? lot.principal : 0
    credit.outstandingCoupon += couponDue
    if (principalDue > 0) credit.outstandingPrincipal = principalDue
    let couponPaid = 0, principalPaid = 0, couponLost = 0, principalLost = 0
    if (issuer.status === 'defaulted' || issuer.status === 'resolved') {
      if (credit.paymentStatus !== 'defaulted') {
        const recoverable = Math.round(lot.principal * config.recovery)
        principalLost = lot.principal - recoverable; couponLost = credit.outstandingCoupon
        credit.principalLost += principalLost; credit.couponLost += couponLost
        credit.outstandingCoupon = 0; credit.outstandingPrincipal = recoverable
        lot.units *= config.recovery; lot.principal = recoverable
        credit.paymentStatus = 'defaulted'
      }
      if (issuer.status === 'resolved') principalPaid = credit.outstandingPrincipal
    } else if (issuer.status === 'performing') {
      couponPaid = credit.outstandingCoupon
      if (s.lap >= lot.maturityLap) principalPaid = lot.principal
    }
    s.portfolio.cash += couponPaid + principalPaid
    credit.outstandingCoupon -= couponPaid
    credit.outstandingPrincipal = Math.max(0, credit.outstandingPrincipal - principalPaid)
    credit.principalPaid += principalPaid; lot.principal -= principalPaid
    lot.lastCouponLap = s.lap
    if ((issuer.status === 'resolved' || (issuer.status === 'performing' && s.lap >= lot.maturityLap)) && credit.outstandingCoupon === 0) {
      lot.units = 0; lot.status = 'matured'; credit.paymentStatus = 'resolved'; credit.costBasis = 0
    } else credit.paymentStatus = issuer.status
    credit.history.push({ lap: s.lap, couponDue, couponPaid, principalDue, principalPaid, couponLost, principalLost, status: credit.paymentStatus })
    const label = `${config.name} · ${lot.id}`
    lines.push({ label: `${label}: coupon đến hạn ${couponDue.toLocaleString('vi-VN')} ₫, thực nhận`, amount: couponPaid })
    if (principalDue > 0 || principalPaid > 0) lines.push({ label: `${label}: gốc đến hạn ${principalDue.toLocaleString('vi-VN')} ₫, thực nhận/thu hồi`, amount: principalPaid })
    if (credit.outstandingCoupon + credit.outstandingPrincipal > 0) lines.push({ label: `${label}: chưa nhận coupon ${credit.outstandingCoupon.toLocaleString('vi-VN')} ₫ / gốc ${credit.outstandingPrincipal.toLocaleString('vi-VN')} ₫`, amount: 0 })
    if (principalLost + couponLost > 0) lines.push({ label: `${label}: mất gốc ${principalLost.toLocaleString('vi-VN')} ₫ / coupon ${couponLost.toLocaleString('vi-VN')} ₫; chưa phải dòng tiền`, amount: 0 })
  }
  return lines
}
