import { boardFor } from '../data/board'
import { CATEGORIES } from '../data/config'
import type { GameState } from '../game/types'
import { City } from './City'
import { Icon } from './Icon'

const dots: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
export function Board({ game, onRoll, rolling }: { game: GameState; onRoll: () => void; rolling: boolean }) {
  return <section className="board-shell" aria-label="Bàn cờ 20 ô">
    <div className="board-grid">
      {boardFor(game).map(tile => <div key={tile.index} style={{ gridRow: tile.row, gridColumn: tile.col }} className={`tile ${tile.category} ${tile.index === 0 ? 'start-tile' : ''} ${game.position === tile.index ? 'active' : ''}`} aria-label={`Ô ${tile.index + 1}: ${tile.label}${game.position === tile.index ? ', bạn đang ở đây' : ''}`} aria-current={game.position === tile.index ? 'step' : undefined}>
        <span className="tile-number">{String(tile.index + 1).padStart(2, '0')}</span>
        <Icon name={tile.icon} size={25} />
        <span className="tile-label">{tile.label}</span>
        {game.position === tile.index && <span className="player-token" aria-hidden="true">●</span>}
        {tile.index === 0 && <span className="start-arrow">→</span>}
      </div>)}
      <div className="board-center">
        <span className="eyebrow">ĐI MỘT VÒNG · HỌC MỘT ĐIỀU</span>
        <h2>Xoay Vòng<br /><em>Tiến Lui</em><span className="title-spark">✳</span></h2>
        <City />
        <div className="dice-area">
          <div className={`die ${rolling ? 'rolling' : ''}`} role="img" aria-label={game.dice ? `Xúc xắc ${game.dice}` : 'Xúc xắc sẵn sàng'}>{Array.from({ length: 9 }, (_, i) => <span key={i} className={(dots[game.dice || 5].includes(i + 1) ? 'visible' : '')} />)}</div>
          <button className="button primary roll-button" onClick={onRoll} disabled={game.phase !== 'rolling' || rolling}>{rolling ? 'Đang gieo…' : 'Gieo xúc xắc'}<Icon name="arrow" size={18} /></button>
        </div>
        <p className="board-hint" aria-live="polite">{rolling ? 'Cơ hội nào đang chờ bạn?' : game.dice ? `Vừa gieo ${game.dice} · Đang ở ô ${game.position + 1}/20` : 'Hành trình bắt đầu từ một lần gieo.'}</p>
      </div>
    </div>
    <div className="board-legend">{Object.entries(CATEGORIES).map(([key, cat]) => <span key={key}><i className={key} />{cat.short}</span>)}<span className="legend-player"><i />Bạn</span></div>
  </section>
}
