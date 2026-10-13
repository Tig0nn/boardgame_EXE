import { Portfolio } from '../../../src/components/Portfolio'
import { Modal } from '../../../src/components/Modal'
import { MarketDetails } from '../../../src/components/MarketDetails'
import type { GameState } from '../../../src/game/types'

export function PortfolioDrawer({ game, onClose }: { game: GameState; onClose: () => void }) {
  return <Modal title="Ví tài sản" onClose={onClose}>
    <Portfolio game={game} />
    <details><summary>Cổ phiếu và lịch sử giá</summary><MarketDetails game={game} asset="stocks" /></details>
    <details><summary>Trái phiếu</summary><MarketDetails game={game} asset="bonds" /></details>
    <details><summary>Vàng</summary><MarketDetails game={game} asset="gold" /></details>
  </Modal>
}