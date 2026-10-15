import { useRef, useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { RULES, ECONOMY } from '../../../src/data/config'
import { money } from '../../../src/game/format'
import { Icon } from '../../../src/components/Icon'
import { C20_BOARD } from '../../../src/data/board'

const steps = [
  { title: 'Từ vốn nhỏ, tới ước mơ lớn', tag: 'ĐÍCH ĐẾN CỦA BẠN',
    text: 'Đi một vòng phố, nắm lấy cơ hội. Bạn có 4 vòng để chạm đích!',
    detail: 'Mục tiêu là nguồn tiền hợp lệ: tiền mặt + gốc tiết kiệm đang gửi + giá bán tài sản tài chính sau phí, trừ nợ và các khoản phải trả. Vốn kinh doanh chưa bán và lãi tiết kiệm chưa nhận không được tính.' },
  { title: 'Một thành phố đầy cơ hội', tag: 'KHÁM PHÁ BÀN CỜ',
    text: 'Mỗi ô dừng mở một câu chuyện. Đi ngang qua thì không kích hoạt ô.',
    detail: 'Qua START nhận lương và các khoản đến hạn. Ô Kinh doanh cho mua, nâng cấp hoặc bán quán. Ô thị trường cho mua đúng loại tài sản. Biến cố có thể đổi giá thị trường hoặc tạo khoản cần thanh toán.' },
  { title: 'Chạm xúc xắc, lên đường!', tag: 'MỘT LƯỢT CHƠI',
    text: 'Gieo xúc xắc, theo chân nhân vật và chọn cách đi tiếp của bạn.',
    detail: 'Chỉ quyết định khi nhân vật dừng. Mỗi lần ghé ô Cổ phiếu, Vàng hoặc Trái phiếu chỉ mua một lần; mua xong là quay lại bàn cờ. Bạn có thể bỏ qua hoặc mua tiếp khi gặp lại ô ở lượt sau. Mở quán và gửi một khoản tiết kiệm xong cũng trở về bàn cờ.' },
  { title: 'Để đồng tiền cùng bạn lớn lên', tag: 'CHỌN CÁCH KIẾM TIỀN',
    text: 'Giữ chút tiền mặt, phần còn lại hãy chọn cơ hội phù hợp.',
    detail: 'Ngân hàng: một khoản gửi mới mỗi lần ghé, kỳ hạn 1/2/3 lần qua START với lãi 4/5/6% mỗi kỳ, lãi đơn nhận cuối hạn; các khoản độc lập, không tự tái tục. Cổ phiếu, vàng, trái phiếu được bán tại START. Quán chỉ được nâng cấp hoặc bán từ lần ghé ô Kinh doanh sau lượt mua; mỗi lần ghé nâng tối đa một tầng. Quán nhận 3 triệu + 700 nghìn mỗi tầng + 1 triệu mỗi tầng hợp sở thích khách tại START; giá bán chịu thị trường và khấu hao. Giá tài sản có thể giảm. Các mức giá trong trò chơi là mô phỏng, không phải dữ liệu giao dịch thực tế.' },
  { title: 'Luôn chừa tiền cho bất ngờ', tag: 'KHI CẦN THANH TOÁN',
    text: 'Dừng ở ô Sinh hoạt cần trả tiền. Thiếu tiền mặt? Bạn vẫn có thể xoay xở.',
    detail: 'Tiền mặt được dùng trước. Phần còn thiếu có thể kết hợp rút toàn khoản tiết kiệm, bán cổ phiếu/trái phiếu/vàng và vay trong hạn mức 30 triệu. Rút sớm mất toàn bộ lãi kỳ hạn chưa trả; tiền thừa vẫn ở ví. Vay chịu lãi 10% ở kỳ trả kế tiếp; vay tại START cuối được cộng lãi vào nợ ngay. Không bán khẩn cấp quán kinh doanh. Hết nguồn thanh toán thì hành trình kết thúc.' },
  { title: 'Về đích với một chiếc ví vững vàng', tag: 'SẴN SÀNG CHƯA?',
    text: 'Cuối vòng 4, đủ tiền mua món đồ mơ ước và vẫn còn dự phòng là chiến thắng!',
    detail: 'Mua món đồ 80 triệu và giữ ít nhất 10 triệu dự phòng: cần tổng 90 triệu nguồn tiền hợp lệ sau phí, nợ và nghĩa vụ. Nếu chưa đủ hoặc hết khả năng thanh toán, hãy thử một hành trình mới. Sổ tay luôn ở ngay trên màn hình để bạn xem lại bất cứ lúc nào.' },
]

export function BoardGuide() {
  return <ol className="rulebook-board">{C20_BOARD.map(tile => <li key={tile.index} value={tile.index + 1}><Icon name={tile.icon} size={16} /> {tile.label}</li>)}</ol>
}

export function Tutorial({ firstTime, onClose }: { firstTime: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const step = steps[index]
  const navigate = (next: number) => { setIndex(next); heading.current?.focus({ preventScroll: true }) }
  return <Modal title={firstTime ? 'Hướng dẫn chơi' : 'Sổ tay hành trình'} className="tutorial" onClose={firstTime ? undefined : onClose}>
    <div className="tutorial-topline"><span className="section-kicker">{firstTime ? 'CHÀO MỪNG TÂN BINH' : 'SỔ TAY HÀNH TRÌNH'}</span>
      {firstTime && <button className="text-button" onClick={onClose}>Bỏ qua hướng dẫn</button>}</div>
    <div className="tutorial-progress" role="progressbar" aria-label="Tiến độ hướng dẫn" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
      {steps.map((item, i) => <span key={item.title} className={i <= index ? 'visited' : ''} data-current={i === index} />)}</div>
    <div className={`tutorial-scene scene-${index}`} aria-hidden="true"><span><Icon name={['flag', 'bank', 'bolt', 'leaf', 'wallet', 'check'][index]} size={40} /></span><b>XOAY VÒNG TIẾN LUI</b></div>
    <section className="tutorial-content" aria-live="polite" aria-atomic="true">
      <span className="section-kicker">{index + 1} / {steps.length} · {step.tag}</span>
      <h2 ref={heading} tabIndex={-1}>{step.title}</h2><p>{step.text}</p>
      {index === 0 && <div className="tutorial-goal"><div><small>Vốn ban đầu</small><strong>50 triệu</strong></div><span aria-hidden="true">→</span><div><small>Mục tiêu sau 4 vòng</small><strong>90 triệu</strong></div></div>}
      {index === 1 && <div className="tutorial-tiles">{[['🏦', 'Ngân hàng', 'Gửi tiết kiệm'], ['📈', 'Thị trường', 'Mua tài sản'], ['🧋', 'Kinh doanh', 'Mở & nâng quán'], ['📚', 'Khóa học', 'Tăng lương'], ['🧾', 'Sinh hoạt', 'Trả chi phí'], ['⚡', 'Biến cố', 'Đón bất ngờ']].map(([icon, title, text]) => <div key={title}><span aria-hidden="true">{icon}</span><strong>{title}</strong><small>{text}</small></div>)}</div>}
      {index === 2 && <ol className="tutorial-turn">{['Gieo xúc xắc', 'Nhân vật di chuyển', 'Khám phá ô dừng', 'Chọn hành động'].map((title, i) => <li key={title}><b>{i + 1}</b>{title}</li>)}</ol>}
      {index === 3 && <ul className="tutorial-earn"><li><span>🏦 Tiết kiệm</span><b>Nhận gốc + lãi khi đến hạn</b></li><li><span>📈 Cổ phiếu</span><b>Mua ở ô · Bán tại START</b></li><li><span>🧋 Mở quán</span><b>+{money(ECONOMY.business.baseIncome)} / START</b></li><li><span>📚 Khóa học</span><b>Lương +{money(RULES.courseBoost)} / vòng</b></li></ul>}
      {index === 4 && <><div className="tutorial-bill"><span>Sinh hoạt khi dừng đúng ô</span><strong>{money(RULES.livingCost)}</strong></div><p className="tutorial-tip">Tiền mặt → Rút tiết kiệm / Bán tài sản / Vay</p></>}
      {index === 5 && <div className="tutorial-goal"><div><small>Món đồ mơ ước</small><strong>80 triệu</strong></div><span aria-hidden="true">+</span><div><small>Tiền dự phòng</small><strong>10 triệu</strong></div></div>}
      <details key={index}><summary>Luật chi tiết</summary><p>{step.detail}</p>
        {index === 1 && <BoardGuide />}
        {index === 3 && <p>Kỳ hạn 1 / 2 / 3 START: lãi đơn cuối kỳ lần lượt 4% / 10% / 18% tiền gốc. Giá thị trường là dữ liệu hư cấu trong game; không phải giá giao dịch thực tế.</p>}
        {index === 3 && <p>Đầu vòng đọc Bản tin thị trường; tại ô mua mở “Xem tín hiệu thị trường”. Cuối vòng, “Dự báo vs. Thực tế” cho biết giá đã đổi ra sao, không phải lãi đầu tư của bạn. Quán vẫn dùng sở thích khách, không dùng bảng dự báo này.</p>}
        {index === 5 && <><p>Game tính nguồn tiền có thể huy động theo báo giá hợp lệ, không tự tạo giao dịch thanh lý toàn bộ tài sản.</p><p>AI Coach là gợi ý tùy chọn, có thể không sẵn sàng hoặc nhận xét sai. Hãy đối chiếu với nhật ký ván chơi.</p></>}
      </details>
    </section>
    <footer className="tutorial-actions"><button className="button secondary" disabled={index === 0} onClick={() => navigate(index - 1)}>Quay lại</button>
      <button className="button primary" onClick={() => index === steps.length - 1 ? onClose() : navigate(index + 1)}>{index === steps.length - 1 ? firstTime ? 'Sẵn sàng chơi!' : 'Đóng sổ tay' : 'Tiếp theo →'}</button></footer>
  </Modal>
}
