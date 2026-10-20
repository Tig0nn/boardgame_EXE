import { investmentLotLabel, maturityLabel, savingsPeriodExplanation } from './player-language'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ASSETS, ECONOMY, SCENARIOS, SECTORS } from '../data/config'
import { businessRulesForGame, businessUpgradeUnlocked } from '../game/business'
import { money, percent } from '../game/format'
import { businessOverview, depositPreview, purchasePreview, stockQuote } from '../game/selectors'
import type { Asset, GameState, RebalanceAction, Term, TradableAsset } from '../game/types'
import { MarketDetails } from './MarketDetails'
import { MoneyInput } from './MoneyInput'
import { savingsProfileForGame } from '../game/savings'
import { encounterActionUsed, investmentPurchaseUsed, investmentPurchasesComplete, singleActionEncounters } from '../game/encounters'
import { BusinessPanel } from './BusinessPanel'
import { SavingsTerms } from './SavingsTerms'
import { hasBondCredit } from '../game/bond-credit'
import { BondCreditPanel } from './BondCreditPanel'
import { tileTradingEnabled } from '../game/encounters'
import { InvestmentEncounter } from './InvestmentEncounter'
import { localizeNarrative } from './glossary'

export function TradingPanel({ game, onTransaction, onSkip, compact = false, marketContext, buyOnly=false }: { game: GameState; onTransaction: (action: RebalanceAction) => boolean | void; onSkip: () => void; compact?: boolean; buyOnly?: boolean; marketContext?: (asset: TradableAsset, symbolId: string) => ReactNode }) {
  const tile = game.eventId as Asset | 'bank'
  const [amount, setAmount] = useState(tile === 'bonds' ? ECONOMY.bondTicket : tile === 'gold' ? ECONOMY.goldTicket : ECONOMY.stockTicket)
  const [symbolId, setSymbolId] = useState(game.market.stocks[0].id)
  const [term, setTerm] = useState<Term>(1)
  const [trend, setTrend] = useState(game.scenarioId)
  const submitLock = useRef(false)
  const submit = (action: RebalanceAction) => {
    if (submitLock.current) return
    submitLock.current = true
    try {
      // A parent input guard may reject a fast second tap without changing the snapshot.
      if (onTransaction(action) === false) submitLock.current = false
    } catch (error) {
      submitLock.current = false
      throw error
    }
  }
  const preview = purchasePreview(game, amount)
  const rates = savingsProfileForGame(game).rates
  const quote = stockQuote(game, symbolId)
  const deposit = depositPreview(game, amount, term)
  const last = game.log.at(-1)
  const financialTile = tile === 'stocks' || tile === 'gold' || tile === 'bonds'
  const atomicInvestment = financialTile && investmentPurchasesComplete(game)
  if(financialTile&&tileTradingEnabled(game)&&!buyOnly)return <InvestmentEncounter game={game} onTransaction={onTransaction} onSkip={onSkip} buyPanel={<TradingPanel game={game} onTransaction={onTransaction} onSkip={onSkip} compact={compact} marketContext={marketContext} buyOnly/>}/>
  const feedback = last?.kind === 'rebalancing' && last.turn === game.turn
    ? <p className="transaction-feedback" role="status">Đã thực hiện: {localizeNarrative(last.decision)}. Tiền mặt còn {money(game.portfolio.cash)}.</p> : null
  if (atomicInvestment && investmentPurchaseUsed(game)) return <section>
    <p>Đã mua trong lượt này.</p><button className="button secondary full-button" onClick={onSkip}>Về bàn chơi</button>
  </section>
  if (tile === 'bonds' && hasBondCredit(game)) return <BondCreditPanel game={game} onTransaction={submit} onSkip={onSkip} marketContext={marketContext} />
  if (tile === 'business' && businessRulesForGame(game) === 'v2.4-customer-preferences') {
    return <BusinessPanel game={game} onTransaction={submit} feedback={feedback} compact={compact} />
  }
  if (tile === 'business') {
    const config = ECONOMY.business
    const view = businessOverview(game, trend)
    const owned = view.locked > 0
    const fixedIncome = businessRulesForGame(game) === 'v2.3-fixed-income'
    const upgradeReason = encounterActionUsed(game, 'upgrade') ? 'Đã nâng cấp một lần tại ô này. Hãy gặp ô Kinh doanh ở lượt sau để nâng cấp tiếp.'
      : !businessUpgradeUnlocked(game) ? 'Nâng cấp mở từ lần gặp ô Kinh doanh tiếp theo sau khi mua.'
      : view.levels >= config.maxUpgrades ? `Đã đạt tối đa ${config.maxUpgrades} tầng nâng cấp.`
      : game.portfolio.cash < config.upgradeCost ? 'Chưa đủ tiền mặt để nâng cấp.' : ''
    return <section className="trading-panel">{feedback}
      <div className="trade-facts business-facts">
        <div><span>Thu nhập tại ô Xuất phát theo hiện trạng</span><strong>{owned ? money(view.income) : 'Chưa có cơ sở'}</strong></div>
        <div><span>Báo giá bán hiện tại</span><strong>{money(view.sale)}</strong></div>
        <div><span>Vốn đã chi, chưa thu hồi</span><strong>{money(view.locked)}</strong></div>
        <div><span>Số lần qua ô Xuất phát còn lại</span><strong>{view.remainingStarts} kỳ</strong></div>
      </div>
      <p className="financial-warning">Thu nhập vận hành dương không đảm bảo tổng lợi nhuận. Chỉ bán tại ô Kinh doanh; vốn chưa bán không tính vào mục tiêu 90 triệu và không dùng trả khoản thiếu bắt buộc.</p>
      <p>{fixedIncome ? `Nền cố định ${money(config.baseIncome)} / lần qua ô Xuất phát khi sở hữu; không nhân theo xu hướng hoặc cú sốc kinh tế.` : `Luật lịch sử: nền ${money(config.baseIncome)} / lần qua ô Xuất phát × hệ số xu hướng, cộng điều chỉnh từ cú sốc kinh tế.`} Nâng cấp {money(config.upgradeCost)}/tầng: +{money(config.baseUplift)} cố định và +{money(config.matchingBonus)} mỗi tầng trùng xu hướng hiện tại.</p>
      <p>Xu hướng hiện tại: <b>{SCENARIOS.find(scenario => scenario.id === game.scenarioId)!.label}</b>. {fixedIncome ? 'Chỉ phần thưởng trùng xu hướng thay đổi khi xu hướng đổi.' : 'Luật lịch sử còn điều chỉnh cả thu nhập nền theo xu hướng.'}</p>
      {!owned ? <><p>Đầu tư {money(config.cost)} · Giá thu hồi ban đầu {config.capitalRecovery * 100}% vốn, trước biến động và khấu hao.</p>
        {game.portfolio.cash < config.cost && <p className="input-error">Chưa đủ tiền mặt để mua cơ sở.</p>}
        <button className="button primary full-button" disabled={game.portfolio.cash < config.cost} onClick={() => submit({ kind: 'buy', asset: 'business', amount: config.cost })}>Đầu tư cơ sở {money(config.cost)}</button></> : <>
        <label htmlFor="business-trend">Xu hướng cho tầng nâng cấp · {view.levels}/{config.maxUpgrades} tầng</label><select id="business-trend" className="text-input" value={trend} onChange={event => setTrend(event.target.value)}>{SCENARIOS.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select>
        <p>Chi {money(config.upgradeCost)}; thu nhập ô Xuất phát tăng {money(view.incrementalIncome)} theo hiện trạng. Phần cơ bản +{money(config.baseUplift)}; thưởng +{money(config.matchingBonus)} chỉ khi trùng xu hướng.</p>
        {upgradeReason && <p className="input-error">{upgradeReason}</p>}
        <button className="button secondary full-button" disabled={!!upgradeReason} onClick={() => submit({ kind: 'upgrade', asset: 'business', amount: config.upgradeCost, trend })}>Nâng cấp {money(config.upgradeCost)}</button>
        <button className="button secondary full-button" onClick={() => submit({ kind: 'sell', asset: 'business', amount: game.portfolio.business })}>Bán toàn cơ sở · Nhận {money(view.sale)}</button>
      </>}
      <details className="trade-details"><summary>Chi phí, thu hồi vốn và rủi ro</summary><p>Giá thu hồi chịu xu hướng kinh tế, khấu hao {config.depreciation * 100}%/vòng và cú sốc kinh tế. Nâng cấp chỉ tăng giá thu hồi bằng {config.upgradeRecovery * 100}% chi phí.</p><p>{fixedIncome ? 'Cú sốc kinh tế đổi giá thu hồi, không đổi thu nhập vận hành. Phần thưởng nâng cấp trùng xu hướng phụ thuộc bối cảnh hiện tại.' : 'Theo luật lịch sử, cú sốc kinh tế có thể đổi cả giá thu hồi và thu nhập.'} Có thể lỗ tổng vốn, hoặc không gặp lại ô để bán trước khi hết {view.remainingStarts} kỳ còn lại.</p></details>
      <p className="inline-note">{singleActionEncounters(game) ? 'Mỗi lần gặp ô chỉ nâng cấp một lần, từ lượt sau khi mua. Bạn vẫn có thể bán cơ sở tại đây. Chọn “Hoàn tất” khi đã xong.' : 'Có thể nâng cấp nhiều tầng hợp lệ hoặc bán tại lần dừng này. Chọn “Hoàn tất” khi đã xong.'}</p>
    </section>
  }
  return <section className={`trading-panel ${tile === 'stocks' ? 'stock-trading' : ''}`}>{feedback}
    {tile === 'stocks' && <>
      <label htmlFor="trade-symbol">Mã cổ phiếu · {SECTORS[quote.stock.sector]}</label><select id="trade-symbol" className="text-input" value={symbolId} onChange={event => setSymbolId(event.target.value)}>{game.market.stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.id} · {stock.name}</option>)}</select>
      <div className="trade-facts"><div><span>Giá / đơn vị</span><strong>{money(quote.stock.currentPrice)}</strong></div><div><span>Thay đổi gần nhất</span><strong>{percent(quote.recent.returnRate)}</strong>{!compact && <small>{quote.recent.kind === 'history' ? 'Lịch sử giả lập trước ván' : `Vòng ${quote.recent.lap} · Lượt ${quote.recent.timestamp}`}</small>}</div>{!compact && <div><span>Đang nắm giữ</span><strong>{quote.units.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} đơn vị</strong></div>}</div>
    </>}
    {tile === 'bank' && <>{compact ? <SavingsTerms name="deposit-term" term={term} rates={rates} onChange={setTerm} /> : <><label htmlFor="deposit-term">Kỳ hạn (lần qua ô Xuất phát)</label><select id="deposit-term" className="text-input" value={term} onChange={event => setTerm(Number(event.target.value) as Term)}>{([1, 2, 3] as Term[]).map(value => <option key={value} value={value}>{value} kỳ · Lãi {Math.round(rates[value] * 100)}%/kỳ</option>)}</select><p className="savings-period-note">{savingsPeriodExplanation}</p></>}
      <p>{maturityLabel(deposit.maturityLap)} · Nhận lãi {money(deposit.interest)}</p>
      {deposit.maturityLap > game.totalLaps && <p className={compact ? 'inline-note' : 'financial-warning'}>Đến hạn sau khi hết ván; rút sớm mất lãi chưa nhận.</p>}
    </>}
    {tile === 'bonds' && <p>Giá {money(game.market.bond.currentPrice)}/đơn vị · Lãi {ECONOMY.bond.coupon * 100}% mệnh giá/vòng · Kỳ hạn {ECONOMY.bond.term} lần qua ô Xuất phát · Phí bán {ECONOMY.tradeFees.bonds * 100}%.{!compact && ' Bán sớm có thể lỗ vốn.'}</p>}
    {tile === 'gold' && <p>Giá {money(game.market.gold.currentPrice)}/đơn vị · Khi bán: chênh lệch {ECONOMY.goldSpread * 100}% + phí {ECONOMY.tradeFees.gold * 100}%.{!compact && ' Không có lãi định kỳ.'}</p>}
    {tile !== 'bank' && marketContext?.(tile, symbolId)}
    <label htmlFor="trade-amount">Số tiền {tile === 'bank' ? 'gửi' : 'mua'}</label><MoneyInput id="trade-amount" amount={amount} onChange={setAmount} invalid={!preview.valid} />
    <div className="trade-remaining"><span>Tiền mặt sau giao dịch</span><strong>{preview.cashAfter === null ? '—' : money(preview.cashAfter)}</strong></div>
    {!preview.valid && <p className="input-error" role="status">{preview.error}</p>}
    {tile === 'stocks' && <p className="trade-risk">Phí mua 0 ₫ · Phí bán {ECONOMY.tradeFees.stocks * 100}%.{!compact && ' Giá có thể giảm; không đảm bảo lợi nhuận.'}</p>}
    <button className="button primary full-button" disabled={!preview.valid} onClick={() => submit({ kind: tile === 'bank' ? 'deposit' : 'buy', asset: tile === 'bank' ? undefined : tile, amount, term, symbolId, ...(tile === 'stocks' || atomicInvestment ? { completeEncounter: true } : {}) })}>{compact ? tile === 'bank' ? 'Gửi tiết kiệm' : 'Mua' : `Xác nhận ${tile === 'bank' ? 'gửi khoản mới' : `mua ${ASSETS[tile].label.toLowerCase()}`}`} {preview.valid ? money(amount) : ''}</button>
    {!compact && <p className="inline-note trade-continuation">{tile === 'stocks' || atomicInvestment ? 'Mua một lần tại ô này; xác nhận xong sẽ trở về bàn chơi.' : tile === 'bank' && singleActionEncounters(game) ? 'Mỗi lần gặp Ngân hàng chỉ gửi một khoản mới. Xác nhận xong sẽ trở về bàn chơi; các khoản cũ giữ nguyên kỳ hạn và lãi suất.' : 'Có thể giao dịch nhiều lần. Chọn “Hoàn tất” sau khi đã xong, hoặc bỏ qua nếu không giao dịch.'}</p>}
    {(tile === 'stocks' || atomicInvestment) && <button className="button secondary full-button stock-skip" onClick={onSkip}>Bỏ qua cơ hội</button>}
    {tile !== 'bank' && <details className="trade-details"><summary>Lịch sử giá và thông tin</summary><MarketDetails game={game} asset={tile} symbolId={symbolId} />{!compact && <p>Lịch sử giá giả lập đã xảy ra, không dự báo lợi nhuận tương lai.</p>}</details>}
    {tile === 'bank' && <details className="trade-details"><summary>Các khoản gửi đang hoạt động</summary>{game.deposits.filter(lot => lot.status === 'active').map(lot => <p key={lot.id}>{investmentLotLabel('savings', lot.id)}: {money(lot.principal)} · {maturityLabel(lot.maturityLap)}</p>)}<p>Mỗi lần gửi tạo một khoản riêng. Không tự tái tục; rút sớm chỉ khi thiếu tiền bắt buộc, rút toàn khoản và mất lãi chưa trả.</p></details>}
  </section>
}
