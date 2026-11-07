// Phase 0 instrument-only calibration. This is not the production engine or a game win-rate study.
import { writeFileSync, mkdirSync } from 'node:fs'
import { hashSeed, random } from '../src/game/random.ts'

const count = Number(process.argv[2] ?? 50000)
if (!Number.isSafeInteger(count) || count < 100) throw new Error('At least 100 seeds required')
const candidates = [
  { id: 'initial-3-8', coupons: [.03, .08] },
  { id: 'liquidity-4.5-9', coupons: [.045, .09] },
  { id: 'liquidity-4.5-10', coupons: [.045, .10] },
  { id: 'moderate-credit-4.5-10', coupons: [.045, .10], moderate: true },
]
const risks = [
  { delay: .035, default: .005, recover: .80, cure: .75 },
  { delay: .16, default: .045, recover: .50, cure: .55 },
]
const rows = []
for (const candidate of candidates) for (let issuer = 0; issuer < 2; issuer++) {
  const results = []
  let defaulted = 0, delayed = 0, coupons = 0, illiquid = 0
  for (let seed = 0; seed < count; seed++) {
    let rng = hashSeed(`bond-prototype-v1:${seed}`)
    const draw = () => { const next = random(rng); rng = next[1]; return next[0] }
    const risk = candidate.moderate && issuer === 1 ? { ...risks[issuer], delay: .10, default: .025 } : risks[issuer]
    let status = 'performing', cash = 0, dueCoupon = 0, hadDelay = false, hadDefault = false
    for (let lap = 1; lap <= 2; lap++) {
      if (status === 'defaulted') { cash += risk.recover; status = 'resolved'; continue }
      if (status === 'resolved') continue
      const scenario = Math.floor(draw() * 3)
      const pick = draw()
      const adverse = scenario === 1 ? (issuer === 0 ? .015 : .04) : 0
      const d = risk.default + adverse
      if (status === 'performing') status = pick < d ? 'defaulted' : pick < d + risk.delay + adverse ? 'delayed' : 'performing'
      else if (status === 'delayed') status = pick < d * 2 ? 'defaulted' : pick < d * 2 + risk.cure ? 'performing' : 'delayed'
      if (status === 'defaulted') { hadDefault = true; continue }
      dueCoupon += candidate.coupons[issuer]
      if (status === 'performing') { cash += dueCoupon; coupons += dueCoupon; dueCoupon = 0 }
      else hadDelay = true
    }
    // End-of-term net executable sale for delays; default recovery happens next START, not now.
    const principal = status === 'performing' ? 1 : status === 'delayed' ? (issuer === 0 ? .75 : .55) * .985 : 0
    results.push(cash + principal - 1)
    defaulted += Number(hadDefault); delayed += Number(hadDelay); illiquid += Number(status === 'defaulted')
  }
  results.sort((a, b) => a - b)
  rows.push({ candidate: candidate.id, issuer: issuer === 0 ? 'A' : 'B', seeds: count,
    coupon: candidate.coupons[issuer], meanReturn: results.reduce((a, b) => a + b, 0) / count,
    medianReturn: results[Math.floor(count / 2)], p05: results[Math.floor(count * .05)],
    lossRate: results.filter(n => n < 0).length / count, delayRate: delayed / count,
    defaultRate: defaulted / count, meanCouponReceived: coupons / count, illiquidAtMaturity: illiquid / count,
    recoveryFractionNextStart: risks[issuer].recover })
}
const output = { model: 'instrument-only-two-START-v1', seedPrefix: 'bond-prototype-v1:', seeds: count,
  bank: { term1TwoStarts: .08, term2: .10, earlyWithdrawalInterest: 0 }, candidates, risks, rows,
  limitations: ['No board, salaries, course, debt, trading timing, partial sales or macro tiles.',
    'Default assets conservatively valued at zero at two-START boundary; next-START recovery reported separately.',
    'Scenario is equally weighted and common by seed; not empirical credit data.',
    'Candidate choice must be checked again with the implemented full game.'] }
mkdirSync('docs/playtests/bond-credit-v25', { recursive: true })
writeFileSync('docs/playtests/bond-credit-v25/phase0-prototype.json', JSON.stringify(output, null, 2) + '\n')
console.table(rows)
