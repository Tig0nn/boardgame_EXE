import type { GameState } from '../game/types'
import { Icon } from './Icon'
import { marketBulletin } from '../../mobile_app/src/game/market-news'
import { GlossaryText } from './FinancialTerm'

export function Forecast({ game, expanded = false }: { game: GameState; expanded?: boolean }) {
  const news = marketBulletin(game)
  return <div className={`forecast ${expanded ? 'expanded' : ''}`}>
    <div className="forecast-intro"><span className="forecast-icon"><Icon name="leaf" /></span><div><span className="eyebrow">DỰ BÁO VÒNG {game.lap}</span><p className="forecast-title">{news.headline}</p></div></div>
    {expanded && <p>{news.context}</p>}
    <div className="forecast-assets">{news.assets.map(item => <div key={item.asset}><span>{item.label}</span><strong><GlossaryText text={item.forecast} /></strong>{expanded && <small><GlossaryText text={item.characteristic} /></small>}</div>)}</div>
    {expanded && <p className="inline-note"><Icon name="info" size={16} /> Dự báo gợi ý xu hướng, không đảm bảo. Giá cập nhật tại START và ngay khi có sự kiện kinh tế.</p>}
  </div>
}
