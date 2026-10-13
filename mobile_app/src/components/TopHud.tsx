import { money } from '../../../src/game/format'

interface TopHudProps {
  cash: number
  debt: number
  lawfulProceeds: number
  targetGoal: number
  isMuted?: boolean
  onToggleMute?: () => void
  onHelp?: () => void
  helpDisabled?: boolean
}

export function TopHud({ cash, debt, lawfulProceeds, targetGoal, isMuted, onToggleMute, onHelp, helpDisabled }: TopHudProps) {
  const progress = Math.max(0, Math.min(100, lawfulProceeds / targetGoal * 100))
  return <header className="mobile-hud">
    <div className="hud-row"><div className="hud-wallet"><span>TIỀN MẶT</span><strong>{money(cash)}</strong></div>
      <div className="hud-actions">
        {onHelp && <button className="hud-help" onClick={onHelp} disabled={helpDisabled} aria-label="Mở sổ tay">?</button>}
        {onToggleMute && <button className="hud-help" onClick={onToggleMute} aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}>{isMuted ? '🔇' : '🔊'}</button>}
      </div>
    </div>
    <div className="hud-goal"><span>🏁 Về đích</span><strong>{(lawfulProceeds / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / {targetGoal / 1_000_000} triệu</strong></div>
    <progress value={progress} max="100" aria-label="Tiến độ nguồn tiền hợp lệ về đích" />
    {debt > 0 && <small>Nợ vay {money(debt)}</small>}
  </header>
}
