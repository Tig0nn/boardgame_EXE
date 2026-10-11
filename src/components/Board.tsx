import { useEffect, useRef, useState } from 'react'
import { boardFor } from '../data/board'
import { CATEGORIES } from '../data/config'
import type { GameState } from '../game/types'
import { City } from './City'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { money } from '../game/format'

const dots: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
const labels: Record<string, string[]> = {
  start: ['Xuất phát'], bank: ['Ngân hàng'], stocks: ['Cổ phiếu'], living: ['Sinh hoạt'],
  course: ['Đầu tư', 'bản thân'], macro: ['Kinh tế'], bonds: ['Trái phiếu'],
  personal: ['Biến cố', 'cá nhân'], business: ['Kinh doanh'], gold: ['Vàng'], obligation: ['Dòng tiền'],
}

export function Board({ game, onRoll, rolling }: { game: GameState; onRoll: () => void; rolling: boolean }) {
  const tiles = boardFor(game)
  const [selected, setSelected] = useState<number | null>(null)
  const tile = selected === null ? null : tiles[selected]
  const rollButton = useRef<HTMLButtonElement>(null)
  const last = game.log.at(-1)
  const purchased = game.phase === 'rolling' && last?.decisionId === 'buy-stocks-complete'
  useEffect(() => {
    if (purchased) { rollButton.current?.focus({ preventScroll: true }); rollButton.current?.scrollIntoView({ block: 'nearest' }) }
  }, [purchased])
  return <section className="city-board" aria-label={`Bàn cờ ${game.boardLayout}, 20 ô`}>
    <div className="board-caption"><span><Icon name="flag" size={16} /> Vòng {game.lap}/{game.totalLaps}</span><span>Chạm ô để khám phá <Icon name="info" size={14} /></span></div>
    <div className="island-scene">
      <svg className="isometric-board" viewBox="0 0 600 425" role="group" aria-label="Đường đi theo thứ tự ô 01 đến 20">
        <path className="island-depth" d="M300 18 592 203v25L300 413 8 228v-25Z" />
        <path className="island-grass" d="m300 18 292 185-292 185L8 203Z" />
        <path className="city-plaza" d="m300 112 152 96-152 96-152-96Z" />
        <City board />
        <text className="city-sign" x="300" y="252" textAnchor="middle">PHỐ TƯƠNG LAI</text>
        <text className="city-subtitle" x="300" y="271" textAnchor="middle">Mỗi lựa chọn, một bước tiến</text>
        {tiles.map(item => {
          const x = 300 + (item.col - item.row) * 49
          const y = 48 + (item.col + item.row - 2) * 31
          const active = game.position === item.index
          return <g key={item.index} transform={`translate(${x} ${y})`} className={`board-tile ${item.category} ${active ? 'active' : ''}`} data-tile-index={item.index} data-category={item.category} role="button" tabIndex={0}
            aria-label={`Ô ${item.index + 1}: ${item.label}${active ? ', bạn đang ở đây' : ''}`} aria-current={active ? 'step' : undefined}
            onClick={() => setSelected(item.index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.index) } }}>
            <title>{item.index + 1}. {item.label} · {CATEGORIES[item.category].short}</title>
            <path className="tile-depth" d="m-47 0 47 29 47-29v9L0 38-47 9Z" />
            <path className="tile-face" d="M0-29 47 0 0 29-47 0Z" />
            <text className="board-tile-number" textAnchor="middle" y="24">{String(item.index + 1).padStart(2, '0')}</text>
            <g transform="translate(-8 -23)"><Icon name={item.icon} size={16} /></g>
            <text className="board-tile-label" textAnchor="middle" y="3">{labels[item.type].map((line, i) => <tspan key={line} x="0" dy={i === 0 ? 0 : 10}>{line}</tspan>)}</text>
          </g>
        })}
        {/* Render above every tile so the token cannot disappear behind the next tile. */}
        <g className="city-player" transform={`translate(${300 + (tiles[game.position].col - tiles[game.position].row) * 49} ${48 + (tiles[game.position].col + tiles[game.position].row - 2) * 31})`} aria-hidden="true">
          <ellipse cy="12" rx="12" ry="6" fill="#214e5540" />
          <path d="M-8 5v-16Q0-23 8-11V5Z" fill="#f56b45" stroke="white" strokeWidth="2" />
          <circle cy="-23" r="8" fill="#ffd9a8" stroke="#623e33" strokeWidth="1.5" />
          <path d="M-11-26 0-36 11-26Z" fill="#ffe69c" stroke="#a36a32" strokeWidth="1.5" />
          <path d="M-3 5v6M4 5v6" stroke="#244a64" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
    <div className="location-card" aria-live="polite"><span className={`location-icon ${tiles[game.position].category}`}><Icon name={tiles[game.position].icon} /></span><div><small>BẠN ĐANG Ở Ô {String(game.position + 1).padStart(2, '0')}</small><strong>{tiles[game.position].label}</strong></div><span className="location-turn">Lượt {game.turn}</span></div>
    <div className="board-legend">{Object.entries(CATEGORIES).map(([key, cat]) => <span key={key}><i className={key} />{cat.short}</span>)}<span className="legend-player"><i />Bạn</span></div>
    <div className="roll-dock">
      <div className={`die ${rolling ? 'rolling' : ''}`} role="img" aria-label={game.dice ? `Xúc xắc ${game.dice}` : 'Xúc xắc sẵn sàng'}>{Array.from({ length: 9 }, (_, i) => <span key={i} className={game.dice && dots[game.dice].includes(i + 1) ? 'visible' : ''} />)}{!game.dice && <b className="die-ready">?</b>}</div>
      <div className="roll-control">{purchased && <p className="purchase-success" role="status">Đã mua cổ phiếu · {last.decision}. Tiền mặt còn {money(game.portfolio.cash)}. Bạn có thể gieo tiếp.</p>}<button ref={rollButton} className="button primary roll-button" onClick={onRoll} disabled={game.phase !== 'rolling' || rolling}>{rolling ? 'Đang gieo…' : 'Gieo xúc xắc'}<Icon name="arrow" size={20} /></button><p className="board-hint" aria-live="polite">{rolling ? 'Cơ hội nào đang chờ bạn?' : game.dice ? `Kết quả: ${game.dice} bước · Vòng ${game.lap}/${game.totalLaps}` : 'Gieo 1 xúc xắc để bắt đầu khám phá'}</p></div>
    </div>
    {tile && <Modal title={`Ô ${tile.index + 1}: ${tile.label}`} onClose={() => setSelected(null)}><span className="section-kicker">Ô {tile.index + 1} / 20 · {CATEGORIES[tile.category].short}</span><h2>{tile.label}</h2><p className="modal-lead">{tile.index === 0 ? 'Đi qua START để quyết toán vòng: nhận lương, cập nhật thị trường, đáo hạn và thanh toán nghĩa vụ.' : 'Sự kiện chỉ kích hoạt khi bạn dừng đúng ô này. Gieo xúc xắc để tiếp tục hành trình.'}</p><button className="button primary full-button" onClick={() => setSelected(null)}>Trở lại bàn chơi<Icon name="arrow" /></button></Modal>}
  </section>
}
