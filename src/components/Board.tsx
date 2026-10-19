import { useEffect, useRef, useState } from 'react'
import { GlossaryText } from './FinancialTerm'
import { boardFor } from '../data/board'
import { CATEGORIES } from '../data/config'
import type { GameState } from '../game/types'
import { SCENE, tileCenter } from './board-scene'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { money } from '../game/format'
import { tileInformation } from './tile-information'

const dots: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
const labels: Record<string, string[]> = {
  start: ['Xuất phát'], bank: ['Ngân hàng'], stocks: ['Cổ phiếu'], living: ['Sinh hoạt'],
  course: ['Đầu tư', 'bản thân'], macro: ['Sự kiện'], bonds: ['Trái phiếu'],
  personal: ['Biến cố', 'cá nhân'], business: ['Kinh doanh'], gold: ['Vàng'], obligation: ['Dòng tiền'],
}

export function Board({ game, onRoll, rolling }: { game: GameState; onRoll: () => void; rolling: boolean }) {
  const tiles = boardFor(game)
  const [selected, setSelected] = useState<number | null>(null)
  const [artFailed, setArtFailed] = useState(false)
  const tile = selected === null ? null : tiles[selected]
  const player = tileCenter(tiles[game.position])
  const scene = useRef<SVGSVGElement>(null)
  const rollButton = useRef<HTMLButtonElement>(null)
  const last = game.log.at(-1)
  const purchased = game.phase === 'rolling' && (last?.decisionId === 'buy-stocks-complete' || last?.decisionId === 'deposit-bank' || last?.decisionId === 'buy-business')
  useEffect(() => {
    if (purchased) { rollButton.current?.focus({ preventScroll: true }); rollButton.current?.scrollIntoView({ block: 'nearest' }) }
  }, [purchased])
  useEffect(() => {
    if (selected === null) return
    const inspected = scene.current?.querySelector<SVGGElement>(`[data-tile-index="${selected}"]`)
    return () => inspected?.focus({ preventScroll: true })
  }, [selected])
  return <section className="city-board" aria-label={`Bàn cờ ${game.boardLayout}, ${tiles.length} ô`}>
    <div className="board-caption"><span><Icon name="flag" size={16} /> Vòng {game.lap}/{game.totalLaps}</span><span>Chạm ô để khám phá <Icon name="info" size={14} /></span></div>
    <div className="island-scene artwork-scene">
      {artFailed && <p className="scene-fallback" role="status">Ảnh thành phố chưa tải được. Bàn chơi vẫn sẵn sàng.</p>}
      <svg ref={scene} className="isometric-board" viewBox={`${SCENE.crop.x} ${SCENE.crop.y} ${SCENE.crop.width} ${SCENE.crop.height}`} role="group" aria-label={`Đường đi theo thứ tự ô01 đến ${tiles.length}`}>
        <rect x="0" y="0" width={SCENE.width} height={SCENE.height} fill="#bce7b5" aria-hidden="true" />
        {!artFailed && game.boardLayout!=='B18' && <image className="city-artwork" href={`${import.meta.env.BASE_URL}art/city-background.webp`} x="0" y="0" width={SCENE.width} height={SCENE.height} preserveAspectRatio="xMidYMid meet" aria-hidden="true" onError={() => setArtFailed(true)} />}
        {tiles.map(item => {
          const { x, y } = tileCenter(item)
          const active = game.position === item.index
          return <g key={item.index} transform={`translate(${x} ${y}) scale(${SCENE.tileScale})`} className={`board-tile ${item.category} ${active ? 'active' : ''}`} data-tile-index={item.index} data-category={item.category} role="button" tabIndex={0}
            aria-label={`Ô ${item.index + 1}: ${item.label}${active ? ', bạn đang ở đây' : ''}`} aria-current={active ? 'step' : undefined}
            onClick={() => setSelected(item.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.index) } }}>
            <title>{item.index + 1}. {item.label} · {CATEGORIES[item.category].short}</title>
            <path className="tile-depth" d="m-47 0 47 29 47-29v9L0 38-47 9Z" />
            <path className="tile-face" d="M0-29 47 0 0 29-47 0Z" />
            <text className="board-tile-number" textAnchor="middle" y="24">{String(item.index + 1).padStart(2, '0')}</text>
            <g className="board-tile-icon" transform="translate(-8 -23)"><Icon name={item.icon} size={16} /></g>
            <text className="board-tile-label" textAnchor="middle" y="3">{labels[item.type].map((line, i) => <tspan key={line} x="0" dy={i === 0 ? 0 : 10}>{line}</tspan>)}</text>
          </g>
        })}
        {/* Render above every tile so the token cannot disappear behind the next tile. */}
        <g className="city-player" transform={`translate(${player.x} ${player.y})`} aria-hidden="true">
          <ellipse className="player-halo" cy="8" rx="23" ry="14" />
          <g transform={`scale(${SCENE.tileScale})`}>
            <ellipse cy="12" rx="12" ry="6" fill="#214e5540" />
            <path d="M-8 5v-16Q0-23 8-11V5Z" fill="#f56b45" stroke="white" strokeWidth="2" />
            <circle cy="-23" r="8" fill="#ffd9a8" stroke="#623e33" strokeWidth="1.5" />
            <path d="M-11-26 0-36 11-26Z" fill="#ffe69c" stroke="#a36a32" strokeWidth="1.5" />
            <path d="M-3 5v6M4 5v6" stroke="#244a64" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
    <div className="location-card" aria-live="polite"><span className={`location-icon ${tiles[game.position].category}`}><Icon name={tiles[game.position].icon} /></span><div><small>BẠN ĐANG Ở Ô {String(game.position + 1).padStart(2, '0')}</small><strong>{tiles[game.position].label}</strong></div><span className="location-turn">Lượt {game.turn}</span></div>
    <div className="board-legend">{Object.entries(CATEGORIES).map(([key, cat]) => <span key={key}><i className={key} />{cat.short}</span>)}<span className="legend-player"><i />Bạn</span></div>
    <div className="roll-dock">
      <div className={`die ${rolling ? 'rolling' : ''}`} role="img" aria-label={game.dice ? `Xúc xắc ${game.dice}` : 'Xúc xắc sẵn sàng'}>{Array.from({ length: 9 }, (_, i) => <span key={i} className={game.dice && dots[game.dice].includes(i + 1) ? 'visible' : ''} />)}{!game.dice && <b className="die-ready">?</b>}</div>
      <div className="roll-control">{purchased && <p className="purchase-success" role="status">{last.decisionId === 'deposit-bank' ? 'Đã gửi tiết kiệm' : last.decisionId === 'buy-business' ? 'Đã mua cơ sở kinh doanh' : 'Đã mua cổ phiếu'} · {last.decision}. Tiền mặt còn {money(game.portfolio.cash)}. Bạn có thể gieo tiếp.</p>}<button ref={rollButton} className="button primary roll-button" onClick={onRoll} disabled={game.phase !== 'rolling' || rolling}>{rolling ? 'Đang gieo…' : 'Gieo xúc xắc'}<Icon name="arrow" size={20} /></button><p className="board-hint" aria-live="polite">{rolling ? 'Cơ hội nào đang chờ bạn?' : game.dice ? `Kết quả: ${game.dice} bước · Vòng ${game.lap}/${game.totalLaps}` : 'Gieo 1 xúc xắc để bắt đầu khám phá'}</p></div>
    </div>
    {tile && <Modal title={`Ô ${tile.index + 1}: ${tile.label}`} onClose={() => setSelected(null)}><span className="section-kicker">Ô {tile.index + 1} / {tiles.length} · {CATEGORIES[tile.category].short}</span><h2>{tile.type==='start'?'Ô Xuất phát (START)':tile.label}</h2><p className="modal-lead"><GlossaryText text={tileInformation(tile.type,game)} /></p><button className="button primary full-button" onClick={() => setSelected(null)}>Trở lại bàn chơi<Icon name="arrow" /></button></Modal>}
  </section>
}
