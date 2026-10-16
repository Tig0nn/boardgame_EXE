import { useRef, useState } from 'react'
import { advance, decide, roll, fundPayment, transact } from './game/engine'
import { createMultiCourseGame } from './game/new-game'
import type { GameState } from './game/types'
import { Setup } from './components/Setup'
import { Board } from './components/Board'
import { Portfolio } from './components/Portfolio'
import { GameStatus } from './components/GameStatus'
import { Forecast } from './components/Forecast'
import { PhaseDialog } from './components/GameDialogs'
import { EventLog, LogDialog } from './components/EventLog'
import { exportLog } from './exportLog'
import { Modal } from './components/Modal'
import { Icon } from './components/Icon'
import './App.css'
import './finance.css'
import './mobile.css'

function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [overlay, setOverlay] = useState<'rules' | 'log' | 'restart' | 'portfolio' | null>(null)
  const [rolling, setRolling] = useState(false)
  const rollLock = useRef(false)
  const rollDice = () => {
    if (rollLock.current || game?.phase !== 'rolling') return
    rollLock.current = true
    setRolling(true)
    setTimeout(() => {
      setGame(state => state && roll(state))
      setRolling(false)
      rollLock.current = false
    }, 450)
  }
  const restart = () => { setGame(null); setOverlay(null) }
  return <>
    <header className="app-header"><a className="brand" href="#" onClick={e => { e.preventDefault(); if (!game || rolling) return; setOverlay('restart') }}><span className="brand-mark"><Icon name="refresh" size={25} /></span><span>Xoay Vòng <em>Tiến Lui</em></span></a><span className="header-tag">TRÒ CHƠI TÀI CHÍNH</span><div className="header-actions"><button className="text-button" onClick={() => setOverlay('rules')}><Icon name="info" size={17} />Luật chơi</button>{game && <button className="button secondary small" disabled={rolling} onClick={() => setOverlay('restart')}><Icon name="refresh" size={15} />Chơi mới</button>}</div></header>
    {!game ? <Setup onStart={(seed, savings, term) => setGame(createMultiCourseGame(seed, savings, term))} /> : <main className="game-page">
      <div className="game-topline"><div><span className="eyebrow">TỪNG BƯỚC XÂY DỰNG TƯƠNG LAI</span><h1>Hành trình của bạn<span className="heading-dot">.</span></h1></div><div className="lap-indicator">{Array.from({ length: game.totalLaps }, (_, i) => <span key={i} className={game.lap === i + 1 ? 'current' : game.lap > i + 1 ? 'complete' : ''}>{game.lap > i + 1 ? <Icon name="check" size={15} /> : <i>{i + 1}</i>}Vòng {i + 1}</span>)}</div></div>
      <div className="game-layout"><div className="play-column"><GameStatus game={game} /><div className="game-tools"><button className="text-button" onClick={() => setOverlay('portfolio')}><Icon name="wallet" size={18} />Tài sản</button><button className="text-button" onClick={() => setOverlay('log')}><Icon name="receipt" size={18} />Nhật ký</button></div><details className="forecast-disclosure"><summary>Dự báo thị trường · Vòng {game.lap}</summary><Forecast game={game} /></details><div className="board-topline"><span><span className="status-dot" /> Bàn chơi của bạn</span><span>{game.gameMode} · {game.boardLayout} · Vòng {game.lap}/{game.totalLaps} <i /> Lượt {game.turn}</span></div><Board game={game} onRoll={rollDice} rolling={rolling} /><EventLog game={game} onOpen={() => setOverlay('log')} /></div><div className="portfolio-sidebar"><Portfolio game={game} /></div></div>
      <PhaseDialog game={game} onAdvance={() => setGame(state => state === game ? advance(state) : state)} onChoose={id => setGame(state => state === game ? decide(state, id) : state)} onRestart={restart} onExport={() => exportLog(game)} onFund={(source, amount, lotId) => setGame(state => state === game ? fundPayment(state, source, amount, lotId) : state)} onTransaction={action => setGame(state => state === game ? transact(state, action) : state)} />
      {overlay === 'portfolio' && <Modal title="Tài sản của bạn" onClose={() => setOverlay(null)}><Portfolio game={game} /></Modal>}
      {overlay === 'log' && <LogDialog game={game} onClose={() => setOverlay(null)} />}
    </main>}
    <footer className="app-footer"><span>XOAY VÒNG TIẾN LUI <i>© 2026</i></span><span>Web MVP · B18 <span className="footer-dot">·</span> Mỗi lựa chọn đều có ý nghĩa.</span></footer>
    {overlay === 'rules' && <Modal title="Luật chơi" onClose={() => setOverlay(null)}><span className="section-kicker">ĐỌC NHỊP · CHỌN HƯỚNG · TIẾN LÊN</span><h2>Luật chơi</h2><div className="rules-content"><p>Bắt đầu với <b>50 triệu</b>, đi <b>{game?.totalLaps ?? 4} vòng</b> trên bàn cờ 18 ô. Cần huy động ít nhất <b>90 triệu sau phí và trừ nợ</b> để đạt mục tiêu duy nhất 90 triệu.</p><p>Chỉ ô dừng kích hoạt. Sinh hoạt 5 triệu thanh toán khi hoàn thành mỗi START. Tại START: thị trường → lương 14 triệu (+2 triệu cơ bản, +4 triệu nâng cao) → kinh doanh → đáo hạn/coupon → sinh hoạt → nợ/nghĩa vụ → quyền bán → dự báo hoặc kết quả.</p><p>Mua hoặc bán tại ô Cổ phiếu, Trái phiếu, Vàng; tối đa một giao dịch thành công mỗi lần ghé. Vẫn được bán tài sản tài chính tại START và funding. Gửi mới tại Ngân hàng. Kinh doanh chỉ bán tại ô Kinh doanh và không bán khẩn cấp. Nâng cấp mở từ lần gặp ô Kinh doanh tiếp theo sau khi mua.</p><p>Hai khóa độc lập: cơ bản 6 triệu / +2 triệu và nâng cao 10 triệu / +4 triệu mỗi START. Mỗi khóa học một lần, mỗi lần ghé mua một khóa bằng tiền mặt hiện có, không vay mới để học. Lương tăng từ START kế tiếp; học phí không hoàn lại. Tiết kiệm mỗi khoản kỳ hạn 1 / 2 / 3 START, lãi game 4/5/6% theo kỳ hạn, trả cuối kỳ; rút sớm toàn khoản mất lãi chưa trả.</p><p>Khi thiếu tiền bắt buộc, chọn kết hợp rút tiết kiệm, bán tài sản tài chính, hoặc vay trong hạn mức 30 triệu. Lãi vay 10%; hết nguồn hợp lệ thì mất khả năng thanh toán.</p><p>Trải nghiệm thị trường tài chính được mô phỏng trong trò chơi. Cú sốc đổi giá ngay; START tính biến động thường từ giá sau cú sốc.</p><p>Nguồn huy động tính tiền mặt + giá bán ròng tài sản tài chính + gốc tiết kiệm rút hợp lệ − nợ và khoản phải trả. Không tính kinh doanh chưa bán hoặc lãi tiết kiệm chưa trả. Cùng seed và lựa chọn tái hiện cùng hành trình.</p></div><button className="button primary full-button" onClick={() => setOverlay(null)}>Đã hiểu <Icon name="check" /></button></Modal>}
    {overlay === 'restart' && <Modal title="Bắt đầu hành trình mới" onClose={() => setOverlay(null)}><h2>Bắt đầu hành trình mới?</h2><p className="modal-lead">Bạn có thể tải nhật ký trước khi rời ván hiện tại. Ván chơi được giữ trong bộ nhớ của trang.</p>{game && <button className="button secondary full-button" onClick={() => exportLog(game)}><Icon name="download" size={17} />Tải nhật ký hiện tại</button>}<button className="button primary full-button" onClick={restart}>Về màn hình thiết lập<Icon name="arrow" /></button></Modal>}
  </>
}
export default App

