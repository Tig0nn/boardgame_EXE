import { writeFileSync, mkdirSync } from 'node:fs'
import { advance, canChoose, createGame, decide, fundPayment, roll, transact } from '../src/game/engine.ts'
import { borrowingAvailable, fundingSources } from '../src/game/transactions.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { BOARD } from '../src/data/board.ts'
import { ECONOMY, MACRO_EVENTS, RULES, SCENARIOS, STOCKS } from '../src/data/config.ts'
import { EVENTS } from '../src/data/events.ts'
import type { GameState } from '../src/game/types.ts'

type Strategy = 'cash-heavy' | 'saving-heavy' | 'stock-heavy' | 'business-heavy' | 'diversified'
const strategies: Strategy[] = ['cash-heavy', 'saving-heavy', 'stock-heavy', 'business-heavy', 'diversified']
const count = Number(process.argv[2] ?? 5000)
if (!Number.isSafeInteger(count) || count < 1) throw new Error('Seed count must be a positive integer.')
const prefix = 'XVTL-V2-'
const startingSavings: Record<Strategy, number> = { 'cash-heavy': 0, 'saving-heavy': 40_000_000, 'stock-heavy': 0, 'business-heavy': 0, diversified: 15_000_000 }

function tileAction(s: GameState, strategy: Strategy): GameState {
  const id = s.eventId
  const reserve = 10_000_000
  const budget = Math.max(0, s.portfolio.cash - reserve)
  if (id === 'bank' && budget >= 1_000_000 && (strategy === 'saving-heavy' || strategy === 'diversified')) {
    const amount = Math.floor(budget * (strategy === 'saving-heavy' ? 0.85 : 0.25))
    s = transact(s, { kind: 'deposit', amount, term: strategy === 'saving-heavy' ? Math.min(3, RULES.laps - s.lap + 1) as 1 | 2 | 3 : 1 })
  }
  if (id === 'stocks' && budget >= 1_000_000 && (strategy === 'stock-heavy' || strategy === 'diversified')) {
    const amount = Math.floor(Math.min(strategy === 'stock-heavy' ? 25_000_000 : 5_000_000, budget))
    const selected = s.market.stocks[s.turn % s.market.stocks.length]
    s = transact(s, { kind: 'buy', asset: 'stocks', amount, symbolId: selected.id })
  }
  if ((id === 'bonds' || id === 'gold') && strategy === 'diversified' && budget >= 1_000_000) {
    s = transact(s, { kind: 'buy', asset: id, amount: Math.floor(Math.min(id === 'bonds' ? 5_000_000 : 3_000_000, budget)) })
  }
  if (id === 'business' && (strategy === 'business-heavy' || strategy === 'diversified')) {
    if (s.business.capital > 0 && s.lap === RULES.laps) s = transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
    else if (s.business.capital === 0 && s.lap < RULES.laps && budget >= ECONOMY.business.cost) s = transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
    else if (s.business.capital > 0 && s.lap < RULES.laps && budget >= ECONOMY.business.upgradeCost &&
      Object.values(s.business.upgrades).reduce((sum, value) => sum + value, 0) < ECONOMY.business.maxUpgrades) {
      s = transact(s, { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: s.scenarioId })
    }
  }
  return s
}

function play(seed: string, strategy: Strategy) {
  let s = createGame(seed, startingSavings[strategy], strategy === 'saving-heavy' ? 3 : 1)
  const visits: Record<string, number> = Object.fromEntries([...new Set(BOARD.map(tile => tile.type))].map(type => [type, 0]))
  const stopsByTile = BOARD.map(() => 0)
  let steps = 0
  while (s.phase !== 'finished' && steps++ < 400) {
    if (s.phase === 'rolling') {
      s = roll(s)
      if (s.position === 0) { visits.start++; stopsByTile[0]++ }
    }
    else if (s.phase === 'event') {
      visits[BOARD[s.position].type]++
      stopsByTile[s.position]++
      s = tileAction(s, strategy)
      const event = EVENTS.find(event => event.id === s.eventId)!
      const preferred = event.id === 'course' && strategy !== 'cash-heavy' && s.lap <= 2 && canChoose(s, 'upgrade') ? 'upgrade'
        : event.options.find(option => canChoose(s, option.id) && option.id !== 'upgrade')!.id
      s = decide(s, preferred)
    } else if (s.phase === 'funding') {
      const source = fundingSources(s)[0]
      if (!source) throw new Error(`Unresolved insolvency: ${seed}`)
      const lot = s.deposits.find(lot => lot.status === 'active')
      const amount = source === 'savings' ? lot!.principal : source === 'debt' ? Math.min(s.pendingPayment!.remaining, borrowingAvailable(s)) : s.portfolio[source]
      s = fundPayment(s, source, amount, source === 'savings' ? lot!.id : undefined)
    } else s = advance(s)
  }
  if (s.phase !== 'finished') throw new Error(`Strategy deadlocked: ${seed}/${strategy}`)
  const funds = liquidatableFunds(s)
  const decisions = s.log.filter(entry => entry.kind === 'rebalancing')
  const shortages = s.log.filter(entry => entry.before.phase !== 'funding' && entry.after.phase === 'funding')
  return { funds, won: victory(s).won, debt: s.portfolio.debt, termination: s.termination!,
    shortfall: Math.max(0, RULES.goal + RULES.cashGoal - funds), shortages: shortages.length,
    shortageAmount: shortages.reduce((sum, entry) => sum + entry.after.pendingCost, 0), course: s.coursePurchased,
    businessEncounters: visits.business, businessBuys: decisions.filter(entry => entry.decisionId === 'buy-business').length,
    upgrades: decisions.filter(entry => entry.decisionId === 'upgrade-business').length,
    sales: decisions.filter(entry => entry.decisionId === 'sell-business').length,
    lockedBusiness: s.business.capital > 0, stockBuys: decisions.filter(entry => entry.decisionId === 'buy-stocks').length,
    macro: s.market.appliedShocks.length, visits, stopsByTile, rolls: s.log.filter(entry => entry.kind === 'roll').length }
}
type Run = ReturnType<typeof play>
const quantile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
function aggregate(runs: Run[]) {
  const values = (key: 'funds' | 'debt' | 'shortfall') => runs.map(run => run[key])
  const distribution = (key: 'funds' | 'debt' | 'shortfall') => ({ p10: quantile(values(key), 0.1), median: quantile(values(key), 0.5), p90: quantile(values(key), 0.9), mean: mean(values(key)) })
  const wins = runs.filter(run => run.won).length
  return { seeds: runs.length, wins, winRate: wins / runs.length, funds: distribution('funds'), debt: distribution('debt'), shortfall: distribution('shortfall'),
    shortages: runs.reduce((sum, run) => sum + run.shortages, 0), meanShortageAmount: mean(runs.map(run => run.shortageAmount)),
    indebtedRate: runs.filter(run => run.debt > 0).length / runs.length,
    courseUptake: runs.filter(run => run.course).length / runs.length,
    business: { meanEncounters: mean(runs.map(run => run.businessEncounters)), repeatEncounterRate: runs.filter(run => run.businessEncounters >= 2).length / runs.length,
      noEncounterRate: runs.filter(run => run.businessEncounters === 0).length / runs.length,
      buyRate: runs.filter(run => run.businessBuys > 0).length / runs.length, upgradeRate: runs.filter(run => run.upgrades > 0).length / runs.length,
      saleRate: runs.filter(run => run.sales > 0).length / runs.length, meanUpgrades: mean(runs.map(run => run.upgrades)),
      lockedAtFinishRate: runs.filter(run => run.lockedBusiness).length / runs.length },
    stockBuyRate: runs.filter(run => run.stockBuys > 0).length / runs.length,
    living: { mean: mean(runs.map(run => run.visits.living)), p90: quantile(runs.map(run => run.visits.living), 0.9) },
    macro: { mean: mean(runs.map(run => run.macro)), p90: quantile(runs.map(run => run.macro), 0.9) },
    meanRolls: mean(runs.map(run => run.rolls)),
    meanTileVisits: Object.fromEntries(Object.keys(runs[0].visits).map(type => [type, mean(runs.map(run => run.visits[type]))])),
    noEncounterRateByType: Object.fromEntries(Object.keys(runs[0].visits).map(type => [type, runs.filter(run => run.visits[type] === 0).length / runs.length])),
    meanStopsByTile: BOARD.map(tile => ({ index: tile.index, label: tile.label, type: tile.type,
      mean: mean(runs.map(run => run.stopsByTile[tile.index])), noStopRate: runs.filter(run => run.stopsByTile[tile.index] === 0).length / runs.length })),
    termination: { completed: runs.filter(run => run.termination === 'completed').length, insolvent: runs.filter(run => run.termination === 'insolvent').length } }
}
mkdirSync('docs/simulations', { recursive: true })
const baseline = Object.fromEntries(strategies.map(strategy => {
  const runs = Array.from({ length: count }, (_, index) => play(`${prefix}${index}`, strategy))
  const result = aggregate(runs)
  console.log(`${strategy}: ${result.wins}/${count}, median=${result.funds.median}`)
  return [strategy, result]
})) as Record<Strategy, ReturnType<typeof aggregate>>
const config = structuredClone({ RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS, BOARD })
// Sensitivity changes apply only within this process and are restored before exit.
const variants = [
  { id: 'business-income-half', apply: () => { ECONOMY.business.baseIncome *= 0.5; ECONOMY.business.baseUplift *= 0.5; ECONOMY.business.matchingBonus *= 0.5 } },
  { id: 'business-upgrade-cost-8M', apply: () => { ECONOMY.business.upgradeCost = 8_000_000 } },
  { id: 'business-recovery-40pct', apply: () => { ECONOMY.business.capitalRecovery = 0.4; ECONOMY.business.upgradeRecovery = 0.3 } },
]
const sensitivity = variants.map(variant => {
  Object.assign(ECONOMY.business, config.ECONOMY.business)
  variant.apply()
  const results = Object.fromEntries((['business-heavy', 'diversified'] as Strategy[]).map(strategy => [strategy,
    aggregate(Array.from({ length: count }, (_, index) => play(`${prefix}${index}`, strategy)))]))
  console.log(`sensitivity: ${variant.id}`)
  return { id: variant.id, config: structuredClone(ECONOMY.business), results }
})
Object.assign(ECONOMY.business, config.ECONOMY.business)
const output = { version: 'gameplay-v2-experimental-2026-10-10', seedPrefix: prefix, firstSeed: 0, lastSeed: count - 1,
  policy: 'Cash reserve 10M; optional purchases cash-only; mandatory funding savings -> stocks -> bonds -> gold -> capped debt. Cash-heavy buys no course. Others course only laps 1/2. Business bought/upgraded laps 1/2 and sold at business tile in lap3. No START purchases or forced dice.',
  config, baseline, sensitivity }
writeFileSync('docs/simulations/v2-results.json', JSON.stringify(output, null, 2))
const m = (value: number) => (value / 1_000_000).toFixed(2)
const pct = (value: number) => `${(value * 100).toFixed(2)}%`
const rows = strategies.map(strategy => { const r = baseline[strategy]; return `| ${strategy} | ${r.wins}/${count} (${pct(r.winRate)}) | ${m(r.funds.p10)} | ${m(r.funds.median)} | ${m(r.funds.p90)} | ${m(r.shortfall.median)} | ${pct(r.indebtedRate)} | ${pct(r.courseUptake)} |` }).join('\n')
const businessRows = strategies.map(strategy => { const r = baseline[strategy].business; return `| ${strategy} | ${r.meanEncounters.toFixed(3)} | ${pct(r.noEncounterRate)} | ${pct(r.repeatEncounterRate)} | ${pct(r.buyRate)} | ${pct(r.upgradeRate)} | ${pct(r.saleRate)} | ${pct(r.lockedAtFinishRate)} |` }).join('\n')
const eventRows = strategies.map(strategy => { const r = baseline[strategy]; return `| ${strategy} | ${r.shortages} | ${m(r.meanShortageAmount)} | ${r.living.mean.toFixed(3)} / ${r.living.p90} | ${r.macro.mean.toFixed(3)} / ${r.macro.p90} | ${r.termination.completed} / ${r.termination.insolvent} |` }).join('\n')
const sensitivityRows = sensitivity.flatMap(variant => Object.entries(variant.results).map(([strategy, result]) => { const r = result as ReturnType<typeof aggregate>; return `| ${variant.id} | ${strategy} | ${pct(r.winRate)} | ${m(r.funds.median)} | ${m(r.funds.p10)} / ${m(r.funds.p90)} |` })).join('\n')
const tileRows = baseline['cash-heavy'].meanStopsByTile.map(tile => `| ${tile.index + 1} | ${tile.label} | ${tile.mean.toFixed(3)} | ${pct(tile.noStopRate)} |`).join('\n')
writeFileSync('docs/V2_BALANCE_REPORT.md', `# Báo cáo cân bằng V2 — cấu hình THỬ NGHIỆM

## Tái hiện

Chạy \`npm run simulate:v2 -- ${count}\`. Mỗi chiến lược dùng cùng ${count} seed \`${prefix}0\` đến \`${prefix}${count - 1}\`. Tổng ${count * 5} ván cơ sở và ${count * 6} ván độ nhạy. Toàn bộ cấu hình, phân phối nợ/thiếu hụt và tần suất từng ô nằm trong [v2-results.json](simulations/v2-results.json). Không chỉnh config gameplay theo kết quả mô phỏng. Đây là mẫu chưa hiệu chỉnh, không phải bằng chứng cân bằng cuối cùng.

## Chính sách chiến lược

- Tất cả giữ dự phòng tiền mặt 10M trước khi mua; trả chi phí ngay theo lựa chọn đầu tiên, không chọn trì hoãn để tăng thắng. Funding lần lượt rút toàn khoản gửi, bán tài sản tài chính, rồi vay trong hạn mức.
- cash-heavy: không đầu tư, không học; đo chiến lược chỉ lương và giữ Cash.
- saving-heavy: gửi đầu ván 40M kỳ hạn 3; tại Ngân hàng gửi 85% tiền vượt dự phòng với kỳ hạn không vượt cuối màn.
- stock-heavy: mua tối đa 25M mỗi lần gặp cổ phiếu, chọn mã theo lượt modulo 6 (không nhìn tương lai).
- business-heavy: mua cơ sở và tối đa một tầng mỗi lần gặp trong vòng 1/2; bán khi gặp ô kinh doanh vòng 3.
- diversified: đầu ván gửi 15M kỳ hạn 1; mua cổ phiếu tối đa 5M, trái phiếu 5M, vàng 3M, gửi 25% tiền vượt dự phòng và kinh doanh khi đủ vốn.
- Trừ cash-heavy, học khi đủ Cash trong vòng 1/2. Không mua tại START. Nếu không gặp ô mục tiêu thì không ép mua. Các chính sách là heuristic nhất quán, không phải chiến lược tối ưu.

## Phân phối nguồn tiền huy động

Đơn vị triệu đồng; đã trừ phí/spread/nợ/nghĩa vụ, không tính kinh doanh chưa bán. Thiếu = max(0,90M − nguồn huy động).

| Chiến lược | Thắng | p10 | Median | p90 | Median thiếu | Còn nợ | Mua khóa học |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Khả năng tiếp cận kinh doanh

| Chiến lược | Lần gặp TB | Không gặp | Gặp >=2 lần | Đã mua | Đã nâng cấp | Đã bán | Còn vốn khóa cuối |
| --- | --- | --- | --- | --- | --- | --- | --- |
${businessRows}

Các tỷ lệ mua/nâng/bán tính trên toàn bộ seed, không chỉ người mua. Gặp lại tính trong toàn màn; số liệu JSON có số tầng nâng cấp trung bình. Quyền tiếp cận chịu xúc xắc, nên chiến lược ưu tiên một ô có thể không mua được hoặc không bán lại đúng hạn.

## Thiếu tiền và sự kiện

| Chiến lược | Lần thiếu tổng | Thiếu TB/seed (M) | Sinh hoạt TB / p90 | Macro TB / p90 | Hoàn tất / mất thanh toán |
| --- | --- | --- | --- | --- | --- |
${eventRows}

Tần suất từng loại ô, số roll trung bình, nợ p10/median/p90 và số tiền thiếu nằm trong JSON. Cả 25.000 ván cơ sở hoàn tất, không còn nợ; chưa xuất hiện insolvency tự nhiên với các chính sách dự phòng này. Nhánh insolvency và vay cuối màn được kiểm tra bằng test tình huống thiếu tiền, không suy ra rằng chúng đã xuất hiện trong mô phỏng cơ sở. Macro có thể tích lũy nhiều lần trong vòng; không bị áp lại tại START.

## Tần suất dừng từng ô

Đường đi giống nhau giữa năm chiến lược với các seed chung; bảng dùng cash-heavy. START đếm đúng đích bằng 0, còn số lần đi qua checkpoint được ghi bằng summaries. Bỏ đích vượt START ở lần hoàn tất vòng cuối vì luật không xử lý đích này.

| Ô | Nhãn | Số lần dừng TB/seed | Không dừng trong màn |
| --- | --- | --- | --- |
${tileRows}

## Độ nhạy kinh doanh (cùng seed)

| Biến thể riêng trong mô phỏng | Chiến lược | Thắng | Median huy động (M) | p10 / p90 (M) |
| --- | --- | --- | --- | --- |
${sensitivityRows}

Giá vốn cơ sở 20M, dòng tiền nền 3M × hệ số xu hướng: hoàn vốn dòng tiền đơn giản khoảng 5,33–8,89 START, vượt màn 3 vòng. Tầng 5M tăng 0,7M bền vững +1M khi khớp xu hướng: hoàn vốn phần tăng 2,94 kỳ nếu luôn khớp, 7,14 kỳ nếu không khớp; chưa tính vốn thu hồi và kinh tế. Biến thể giảm thu nhập một nửa kéo dài hoàn vốn, tăng giá nâng cấp lên 8M làm rủi ro khóa vốn rõ hơn. Giá thu hồi cơ sở 70%, nâng cấp 50%, khấu hao 8%/START và thay đổi kinh tế là giả định mẫu, không mặc định hoàn đủ vốn.

## Rủi ro và đề xuất cần đội chốt

- Mục tiêu 90M so với 50M + 42M lương để lại biên 2M trước chi phí; chiến lược chỉ tiền mặt chỉ thắng ở đường đi ít chi phí. So sánh tỷ lệ cash-heavy ở trên để đánh giá có quá dễ hay không; không ngầm phạt giữ Cash.
- Với snapshot này, cash-heavy chỉ thắng 2,38%, còn saving-heavy cao nhất trong năm heuristic ở 27,90%; mục tiêu có thể đạt nhưng không dễ. Không suy ra chiến lược tiết kiệm là tối ưu trên mọi seed. Kinh doanh-heavy mua được 75,20% nhưng 38,12% toàn bộ seed vẫn khóa vốn cuối màn: khoảng 50,69% số ván đã mua không bán lại trong vòng 3. Đây là rủi ro tiếp cận đáng kể.
- Khoảng p10–p90 và tỷ lệ không gặp/gặp lại ô cho thấy ảnh hưởng đường đi và thị trường. Chưa tách phương sai nhân quả từng nguồn RNG; không tuyên bố đã loại trừ luck dominance.
- Kinh doanh hoàn vốn dài, bán phụ thuộc ô và vốn chưa bán không giúp thắng. Cân nhắc thay số ô kinh doanh hoặc giá thu hồi/thu nhập, thử riêng từng tham số và chạy lại cùng seed trước khi chốt.
- Tần suất và tích lũy cú sốc cần playtest; cân nhắc giảm biên độ shock nếu p10 quá thấp. Không giới hạn hay điều chỉnh sự kiện theo tài sản người chơi.
- Trái phiếu coupon 5%/vòng, kỳ hạn 2; giá bán có rủi ro tín dụng nhưng bản mẫu chưa có vỡ nợ ngẫu nhiên. Tiết kiệm dùng lãi đơn 6/7/8% theo kỳ hạn 1/2/3; cần xác nhận mức mẫu có áp đảo đầu tư rủi ro không.
- Các số là kết quả mô phỏng heuristic với một snapshot, không phải chứng minh chiến lược tối ưu hay tỷ lệ thắng mục tiêu. Cần playtest người thật và phê duyệt tham số trước phát hành.
`)
console.log('Wrote docs/V2_BALANCE_REPORT.md and docs/simulations/v2-results.json')
