import type { BondIssuerId } from '../game/types.ts'

// Educational candidate parameters, not real credit ratings or empirical probabilities.
export const BOND_ISSUERS = [
  { id: 'an-tam', name: 'Hợp tác xã An Tâm', rating: 'AA', riskLabel: 'Thận trọng', coupon: .045,
    faceValue: 100_000, term: 2, delay: .035, default: .005, cure: .75, recovery: .8,
    uncertainPenalty: .015, stressPenalty: .01, volatility: .015, distressedPrice: .75,
    description: 'Coupon thấp hơn, khả năng trả đúng hạn cao hơn. Vẫn có thể chậm trả hoặc mất vốn.' },
  { id: 'but-pha', name: 'Công ty Bứt Phá', rating: 'B', riskLabel: 'Mạo hiểm', coupon: .10,
    faceValue: 100_000, term: 2, delay: .10, default: .025, cure: .55, recovery: .5,
    uncertainPenalty: .04, stressPenalty: .03, volatility: .035, distressedPrice: .55,
    description: 'Coupon cao hơn, dễ chịu áp lực trả nợ. Có thể chậm trả hoặc chỉ thu hồi một phần gốc.' },
] as const

export function bondIssuer(id: BondIssuerId) {
  const issuer = BOND_ISSUERS.find(item => item.id === id)
  if (!issuer) throw new Error('Tổ chức phát hành không hợp lệ.')
  return issuer
}
