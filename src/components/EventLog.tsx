import { localizeNarrative } from './glossary'
import { money } from '../game/format'
import { totalWorth } from '../game/engine'
import type { GameState } from '../game/types'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { exportLog } from '../exportLog'

export function EventLog({ game, onOpen }: { game: GameState; onOpen: () => void }) {
  const recent = game.log.filter(entry => entry.kind !== 'roll').slice(-2).reverse()
  return <section className="recent-log"><div className="panel-heading"><h2>Nhật ký hành trình</h2><button className="text-button" onClick={onOpen}>Xem tất cả <Icon name="arrow" size={15} /></button></div>
    {recent.map(entry => <div className="log-preview" key={entry.sequence}><span className={`log-dot ${entry.kind}`} /><div><strong>{localizeNarrative(entry.title)}</strong><p>{localizeNarrative(entry.kind === 'setup' ? entry.consequence : entry.decision)}</p></div><span>Vòng {entry.before.lap}</span></div>)}
  </section>
}
export function LogDialog({ game, onClose }: { game: GameState; onClose: () => void }) {
  return <Modal title="Nhật ký hành trình" onClose={onClose} wide><span className="section-kicker">MÃ HẠT GIỐNG · {game.seed}</span><h2>Nhật ký hành trình</h2><p className="modal-lead">Mỗi bước đi, lựa chọn và thay đổi danh mục đều được ghi lại.</p><button className="button secondary" onClick={() => exportLog(game)}><Icon name="download" size={17} /> Tải nhật ký JSON</button>
    <div className="full-log">{game.log.toReversed().map(entry => <details key={entry.sequence}><summary><span>#{entry.sequence} · Vòng {entry.before.lap}</span><strong>{localizeNarrative(entry.title)}</strong><Icon name="arrow" size={16} /></summary><div><p><b>Quyết định:</b> {localizeNarrative(entry.decision)}</p><p><b>Hệ quả:</b> {localizeNarrative(entry.consequence)}</p><p><b>Tài sản ròng:</b> {money(totalWorth(entry.before))} → {money(totalWorth(entry.after))}</p><p><b>Lãi tiết kiệm mất:</b> {money(entry.lostSavingsInterest)} · <b>Tài sản bán để trả thiếu:</b> {money(entry.forcedAssetSaleAmount)}</p><p className="inline-note">Dữ liệu kỹ thuật được giữ nguyên trong tệp nhật ký JSON tải xuống.</p></div></details>)}</div>
  </Modal>
}
