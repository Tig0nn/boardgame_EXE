import { useState } from 'react'
import { ASSETS, ECONOMY, SCENARIOS } from '../data/config'
import { businessIncome, businessSaleQuote, businessUpgradeUnlocked } from '../game/business'
import { money } from '../game/format'
import type { Asset, GameState, RebalanceAction, Term } from '../game/types'
import { MarketDetails } from './MarketDetails'

export function TradingPanel({ game, onTransaction }: { game: GameState; onTransaction: (action: RebalanceAction) => void }) {
  const tile = game.eventId as Asset | 'bank'
  const [amount, setAmount] = useState(tile === 'bonds' ? ECONOMY.bondTicket : tile === 'gold' ? ECONOMY.goldTicket : ECONOMY.stockTicket)
  const [symbolId, setSymbolId] = useState(game.market.stocks[0].id)
  const [term, setTerm] = useState<Term>(1)
  const [trend, setTrend] = useState(game.scenarioId)
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= game.portfolio.cash
  if (tile === 'business') {
    const config = ECONOMY.business
    const levels = Object.values(game.business.upgrades).reduce((sum, count) => sum + count, 0)
    return <section className="trading-panel"><p className="financial-warning">Chỉ bán ở ô Kinh doanh. Vốn chưa bán không tính vào nguồn huy động mục tiêu.</p>
      <p>Vốn ban đầu {money(config.cost)} · Dòng tiền cơ bản {money(config.baseIncome)}/START × hệ số xu hướng. Giá thu hồi ban đầu {config.capitalRecovery * 100}% vốn; biến đổi theo kinh tế và khấu hao {config.depreciation * 100}%/vòng.</p>
      <p>Hiện tại: thu nhập {money(businessIncome(game))}/START · Giá bán {money(businessSaleQuote(game))} · {levels}/{config.maxUpgrades} tầng nâng cấp.</p>
      {game.business.capital === 0 ? <button className="button secondary full-button" disabled={game.portfolio.cash < config.cost} onClick={() => onTransaction({ kind: 'buy', asset: 'business', amount: config.cost })}>Đầu tư cơ sở {money(config.cost)}</button> : <>
        <label htmlFor="business-trend">Xu hướng cho tầng nâng cấp</label><select id="business-trend" className="text-input" value={trend} onChange={event => setTrend(event.target.value)}>{SCENARIOS.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select>
        <p>Mỗi tầng trả {money(config.upgradeCost)}, tăng bền vững {money(config.baseUplift)}/START; thêm {money(config.matchingBonus)} chỉ khi trùng xu hướng. Đổi xu hướng vẫn giữ phần bền vững.</p>
        <p>Còn {game.totalLaps - game.lap + 1} kỳ; hoàn vốn phần tăng cơ bản khoảng {(config.upgradeCost / config.baseUplift).toFixed(1)} kỳ. Các tham số đang thử nghiệm.</p>
        {!businessUpgradeUnlocked(game) && <p className="financial-warning">Vừa mở cơ sở. Nâng cấp chỉ mở từ lần gặp ô Kinh doanh tiếp theo.</p>}
        <button className="button secondary full-button" disabled={!businessUpgradeUnlocked(game) || game.portfolio.cash < config.upgradeCost || levels >= config.maxUpgrades} onClick={() => onTransaction({ kind: 'upgrade', asset: 'business', amount: config.upgradeCost, trend })}>Nâng cấp {money(config.upgradeCost)}</button>
        <button className="button secondary full-button" onClick={() => onTransaction({ kind: 'sell', asset: 'business', amount: game.portfolio.business })}>Bán toàn cơ sở · Nhận {money(businessSaleQuote(game))}</button>
      </>}
    </section>
  }
  return <section className="trading-panel">
    {tile === 'stocks' && <><label htmlFor="trade-symbol">Chọn doanh nghiệp giả lập</label><select id="trade-symbol" className="text-input" value={symbolId} onChange={event => setSymbolId(event.target.value)}>{game.market.stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.id} · {stock.name}</option>)}</select></>}
    {tile !== 'bank' && <MarketDetails game={game} asset={tile} symbolId={symbolId} />}
    {tile === 'bank' && <><label htmlFor="deposit-term">Kỳ hạn (lần qua START)</label><select id="deposit-term" className="text-input" value={term} onChange={event => setTerm(Number(event.target.value) as Term)}>{([1, 2, 3] as Term[]).map(value => <option key={value} value={value}>{value} vòng · {Math.round(ECONOMY.savingsRates[value] * 100)}% lãi game/vòng</option>)}</select>
      <p>Đáo hạn tại START vòng {game.lap + term - 1}. Lãi đơn trả cuối kỳ {money(Math.round(amount * ECONOMY.savingsRates[term] * term))}. Khoản cũ giữ nguyên.</p>
      {game.lap + term - 1 > game.totalLaps && <p className="financial-warning">Kỳ hạn vượt màn chơi, chưa đáo hạn khi kết thúc. Rút sớm hợp lệ mất toàn bộ lãi chưa trả.</p>}
      {game.deposits.filter(lot => lot.status === 'active').map(lot => <p key={lot.id}>{lot.id}: {money(lot.principal)} · đáo hạn vòng {lot.maturityLap}</p>)}
    </>}
    <label htmlFor="trade-amount">Số tiền {tile === 'bank' ? 'gửi' : 'mua'}</label><input id="trade-amount" className="text-input" type="number" min="1" max={game.portfolio.cash} step="1" value={amount} onChange={event => setAmount(Number(event.target.value))} />
    <p>Tiền mặt sau giao dịch: {valid ? money(game.portfolio.cash - amount) : 'Không đủ tiền mặt hoặc số tiền không hợp lệ'}</p>
    <button className="button secondary full-button" disabled={!valid} onClick={() => onTransaction({ kind: tile === 'bank' ? 'deposit' : 'buy', asset: tile === 'bank' ? undefined : tile, amount, term, symbolId })}>Xác nhận {tile === 'bank' ? 'gửi khoản mới' : `mua ${ASSETS[tile].label.toLowerCase()}`} {money(amount)}</button>
    <p className="inline-note">Có thể giao dịch nhiều lần trong lần dừng ô này; bấm bỏ qua để tiếp tục. Mua tự nguyện cần đủ tiền mặt.</p>
  </section>
}

