import { useState, type ReactNode } from 'react'
import { ECONOMY } from '../data/config'
import { CUSTOMER_PREFERENCES } from '../data/customer-preferences'
import { currentCustomerPreference } from '../game/customer-preferences'
import { businessUpgradeUnlocked } from '../game/business'
import { encounterActionUsed } from '../game/encounters'
import { money } from '../game/format'
import { businessOverview, purchasePreview } from '../game/selectors'
import type { CustomerPreferenceId, GameState, RebalanceAction } from '../game/types'
import { Icon } from './Icon'

export function BusinessPanel({ game, onTransaction, feedback, compact = false }: {
  game: GameState; onTransaction: (action: RebalanceAction) => void; feedback: ReactNode; compact?: boolean
}) {
  const preference = currentCustomerPreference(game)
  const [selected, setSelected] = useState<CustomerPreferenceId>(preference.id)
  const config = ECONOMY.business
  const view = businessOverview(game, selected)
  const owned = view.locked > 0
  const purchase = purchasePreview(game, config.cost)
  const selection = CUSTOMER_PREFERENCES.find(p => p.id === selected)!
  const upgradeReason = encounterActionUsed(game, 'upgrade') ? 'Đã nâng cấp một lần tại ô này. Gặp ô Kinh doanh ở lượt sau để nâng tiếp.'
    : !businessUpgradeUnlocked(game) ? 'Chỉ nâng cấp từ lần gặp ô Kinh doanh sau lượt mua.'
    : view.levels >= config.maxUpgrades ? `Đã đạt tối đa ${config.maxUpgrades} tầng nâng cấp.`
    : game.portfolio.cash < config.upgradeCost ? 'Chưa đủ tiền mặt để nâng cấp.' : ''
  return <section className="trading-panel business-panel">{feedback}
    {!owned ? <>
      <div className="business-intro"><Icon name="shop" size={28} /><div><span>{compact ? 'CƠ HỘI MỚI' : 'QUÁN ĐỒ UỐNG GIẢ LẬP'}</span><h3>Mở quán của bạn</h3></div></div>
      <dl className="business-purchase-facts">
        <div><dt>Vốn đầu tư</dt><dd>{money(config.cost)}</dd></div>
        <div><dt>Thu nhập nền mỗi START</dt><dd>{money(config.baseIncome)}</dd></div>
        <div><dt>Giá thu hồi ban đầu</dt><dd>{money(view.initialSale)}</dd></div>
      </dl>
      <p>{compact ? 'Nhận thu nhập tại START. Bán quán khi ghé lại ô Kinh doanh.' : 'Nhận thu nhập khi qua START. Chỉ bán toàn quán khi gặp lại ô Kinh doanh ở lượt sau.'}</p>
      <p className="inline-note">Tiền mặt sau mua: <b>{purchase.cashAfter === null ? 'Chưa đủ tiền' : money(purchase.cashAfter)}</b>{!compact && '. Mua xong sẽ trở về bàn chơi.'}</p>
      <button className="button primary full-button" disabled={!purchase.valid} onClick={() => onTransaction({ kind: 'buy', asset: 'business', amount: config.cost })}>{compact ? 'Mở quán' : 'Đầu tư cơ sở'} {money(config.cost)}</button>
      {!purchase.valid && <p className="input-error" role="status">Chưa đủ tiền mặt để mở quán.</p>}
    </> : <>
      <div className="customer-preference" data-current-preference={preference.id}>
        <span>KHÁCH HÀNG VÒNG {game.lap} ĐANG ƯA CHUỘNG</span><strong>{preference.label}</strong>
        {!compact && <p>Giữ nguyên trong vòng này; có thể đổi ở vòng sau.</p>}
      </div>
      <div className="trade-facts business-facts">
        <div><span>Thu nhập mỗi START hiện tại</span><strong>{money(view.income)}</strong></div>
        <div><span>Bán toàn quán lúc này</span><strong>{money(view.sale)}</strong></div>
      </div>
      <fieldset className="business-specializations"><legend>Chọn hướng phát triển · {view.levels}/{config.maxUpgrades} tầng</legend>
        {CUSTOMER_PREFERENCES.map(p => <label key={p.id} className={`specialization ${selected === p.id ? 'selected' : ''}`}>
          <input type="radio" name="business-preference" value={p.id} checked={selected === p.id} onChange={() => setSelected(p.id)} />
          <span><strong>{p.label}</strong>{!compact && <small>{p.example}</small>}<small>Đã có {game.business.upgrades[p.id] ?? 0} tầng{p.id === preference.id ? ' · Khách đang thích' : ''}</small></span>
        </label>)}
      </fieldset>
      {compact ? <p className="upgrade-benefits" aria-live="polite">Nâng cấp +<strong>{money(view.incrementalIncome)}/START</strong> với sở thích hiện tại.</p> : <div className="upgrade-benefits" aria-live="polite">
        <span>Chi phí một tầng <b>{money(config.upgradeCost)}</b></span>
        <span>Tăng vĩnh viễn <b>+{money(config.baseUplift)}/START</b></span>
        <span>Thưởng khi trùng sở thích <b>+{money(config.matchingBonus)}/START</b></span>
        <p>Tầng đã mua luôn được giữ. Với khách hàng vòng này, nâng cấp đã chọn tăng <strong>{money(view.incrementalIncome)}/START</strong>.</p>
      </div>}
      {upgradeReason && <p className="input-error" role="status">{upgradeReason}</p>}
      <button className="button primary full-button" disabled={!!upgradeReason} onClick={() => onTransaction({ kind: 'upgrade', asset: 'business', amount: config.upgradeCost, customerPreferenceId: selected })}>Nâng cấp {selection.label} · {money(config.upgradeCost)}</button>
      <button className="button secondary full-button" disabled={game.businessPurchaseTurn === game.turn} onClick={() => onTransaction({ kind: 'sell', asset: 'business', amount: game.portfolio.business })}>Bán toàn cơ sở · Nhận {money(view.sale)}</button>
      {!compact && <p className="inline-note">Mỗi lần gặp ô nâng cấp tối đa một lần. Bạn vẫn có thể bán quán sau nâng cấp, rồi chọn Hoàn tất.</p>}
    </>}
    <details className="trade-details business-risks"><summary>Vốn, thu nhập và rủi ro</summary>
      {compact && <p>Mỗi lần ghé nâng cấp tối đa một tầng, từ lần ghé sau lượt mua. Bạn có thể bán sau nâng cấp. Sở thích khách giữ nguyên trong vòng, có thể đổi ở vòng sau.</p>}
      <p>Vốn đã chi, chưa thu hồi: {money(view.locked)}. Còn {view.remainingStarts} kỳ START. Vốn chưa bán không tính vào mục tiêu 90 triệu và không dùng trả khoản thiếu bắt buộc.</p>
      <p>Nền {money(config.baseIncome)} + {money(config.baseUplift)} mỗi tầng + {money(config.matchingBonus)} mỗi tầng trùng sở thích khách hàng. Thu nhập chỉ nhận tại START; thưởng trùng có thể mất khi sở thích đổi.</p>
      <p>Giá bán chịu thị trường, cú sốc kinh tế và khấu hao {config.depreciation * 100}%/vòng; mỗi nâng cấp chỉ thêm {config.upgradeRecovery * 100}% chi phí vào giá thu hồi. Các yếu tố kinh tế này không trực tiếp đổi thu nhập vận hành.</p>
      <p>Thu nhập dương không đảm bảo hoàn vốn. Bạn có thể không gặp lại ô Kinh doanh để bán trước khi hết ván.</p>
    </details>
  </section>
}
