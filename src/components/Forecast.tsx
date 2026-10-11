import { ASSETS, SCENARIOS } from '../data/config'
import type { GameState } from '../game/types'
import { Icon } from './Icon'

export function Forecast({ game, expanded = false }: { game: GameState; expanded?: boolean }) {
  const scenario = SCENARIOS.find(s => s.id === game.scenarioId)!
  return <div className={`forecast ${expanded ? 'expanded' : ''}`}>
    <div className="forecast-intro"><span className="forecast-icon"><Icon name="leaf" /></span><div><span className="eyebrow">DỰ BÁO VÒNG {game.lap}</span><p className="forecast-title">{scenario.label}</p></div></div>
    {expanded && <p>{scenario.description}</p>}
    <div className="forecast-assets">{(['stocks', 'bonds', 'gold'] as const).map(asset => <div key={asset}><span>{ASSETS[asset].label}</span><strong>{scenario.tendencies[asset]}</strong></div>)}</div>
    {expanded && <p className="inline-note"><Icon name="info" size={16} /> Dự báo gợi ý xu hướng, không đảm bảo. Giá cập nhật tại START và ngay khi có sự kiện kinh tế.</p>}
  </div>
}
