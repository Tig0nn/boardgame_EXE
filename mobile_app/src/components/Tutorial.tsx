import { tileDisplayLabel } from '../../../src/components/player-language'
import { GlossaryText } from '../../../src/components/FinancialTerm'
import { useRef, useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { ECONOMY } from '../../../src/data/config'
import { rulesForGame, MULTI_COURSE_RULES, isMultiCourse } from '../../../src/game/rules-profile'
import { money } from '../../../src/game/format'
import { Icon } from '../../../src/components/Icon'
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board'
import type { GameState } from '../../../src/game/types'
import { livingPresentation } from '../game/living-presentation'
import { businessRulesForGame } from '../../../src/game/business'
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard'

const steps = [
  { title: 'Từ vốn nhỏ, tới ước mơ lớn', tag: 'ĐÍCH ĐẾN CỦA BẠN',
    text: 'Bắt đầu với 50 triệu. Sau 4 lần qua ô Xuất phát, cần gom đủ 90 triệu sau phí và nợ.',
    detail: 'Mục tiêu là nguồn tiền hợp lệ: tiền mặt + gốc tiết kiệm đang gửi + giá bán tài sản tài chính sau phí, trừ nợ và các khoản phải trả. Vốn kinh doanh chưa bán và lãi tiết kiệm chưa nhận không được tính.' },
  { title: 'Một thành phố đầy cơ hội', tag: 'KHÁM PHÁ BÀN CỜ',
    text: 'Chạm ô để xem trước. Gieo xúc xắc → di chuyển → chọn hành động khi dừng; đi ngang không kích hoạt ô.',
    detail: 'Qua ô Xuất phát nhận lương và các khoản đến hạn. Ô Kinh doanh cho mua, nâng cấp hoặc bán quán. Ô thị trường cho mua hoặc bán đúng loại tài sản. Biến cố có thể đổi giá thị trường hoặc tạo khoản cần thanh toán.' },
  { title: 'Chạm xúc xắc, lên đường!', tag: 'MỘT LƯỢT CHƠI',
    text: 'Giữ tiền mặt cho sinh hoạt và bất ngờ. Bạn tự chọn mức dự phòng; đầu tư có thể làm tiền khó rút ngay.',
    detail: 'Chỉ quyết định khi nhân vật dừng. Mỗi lần ghé ô Cổ phiếu, Vàng hoặc Trái phiếu chỉ được một giao dịch mua hoặc bán thành công; xong là quay lại bàn cờ. Giao dịch lỗi không mất quyền. Bạn có thể bỏ qua hoặc giao dịch tiếp khi gặp lại ô ở lượt sau. Mở quán và gửi một khoản tiết kiệm xong cũng trở về bàn cờ.' },
  { title: 'Để đồng tiền cùng bạn lớn lên', tag: 'CHỌN CÁCH KIẾM TIỀN',
    text: 'Tiết kiệm có lãi cố định. Trái phiếu cho tổ chức phát hành vay: lãi trái phiếu định kỳ cao hơn đi cùng rủi ro chậm trả hoặc mất vốn.',
    detail: 'Ngân hàng: một khoản gửi mới mỗi lần ghé, kỳ hạn 1 / 2 / 3 lần qua ô Xuất phát với lãi 4/5/6% mỗi kỳ, lãi tính trên tiền gốc, nhận cuối kỳ hạn; các khoản độc lập, không tự tái tục. Cổ phiếu, vàng, trái phiếu được bán ở ô tương ứng, tại ô Xuất phát và huy động tiền thanh toán. Quán chỉ được nâng cấp hoặc bán từ lần ghé ô Kinh doanh sau lượt mua; mỗi lần ghé nâng tối đa một tầng. Quán nhận 3 triệu + 700 nghìn mỗi tầng + 1 triệu mỗi tầng hợp sở thích khách tại ô Xuất phát; giá bán chịu thị trường và khấu hao. Giá tài sản có thể giảm. Các mức giá trong trò chơi là mô phỏng, không phải dữ liệu giao dịch thực tế.' },
  { title: 'Luôn chừa tiền cho bất ngờ', tag: 'KHI CẦN THANH TOÁN',
    text: 'Dừng ở ô Sinh hoạt cần trả tiền. Thiếu tiền mặt? Bạn vẫn có thể xoay xở.',
    detail: 'Tiền mặt được dùng trước. Phần còn thiếu có thể kết hợp rút toàn khoản tiết kiệm, bán cổ phiếu/trái phiếu/vàng và vay trong hạn mức 30 triệu. Rút sớm mất toàn bộ lãi kỳ hạn chưa trả; tiền thừa vẫn ở ví. Vay chịu lãi 10% ở kỳ trả kế tiếp; vay tại lần qua ô Xuất phát cuối được cộng lãi vào nợ ngay. Không bán khẩn cấp quán kinh doanh. Hết nguồn thanh toán thì hành trình kết thúc.' },
  { title: 'Về đích với một chiếc ví vững vàng', tag: 'SẴN SÀNG CHƯA?',
    text: 'Hoàn thành 4 vòng và tích lũy đủ 90 triệu từ nguồn tiền về đích là chiến thắng!',
    detail: 'Mục tiêu duy nhất: 90 triệu từ tiền mặt, gốc tiết kiệm rút được và tiền bán tài sản tài chính, sau phí, nợ và khoản phải trả. Không cần toàn bộ là tiền mặt, không buộc giữ riêng 10 triệu. Nếu chưa đủ hoặc hết khả năng thanh toán, hãy thử một hành trình mới. Sổ tay luôn ở ngay trên màn hình để bạn xem lại bất cứ lúc nào.' },
]

export function BoardGuide({ game }: { game?: GameState }) {
  const board = game ? boardFor(game) : MULTI_COURSE_B18_BOARD
  return <ol className="rulebook-board">{board.map(tile => <li key={tile.index} value={tile.index + 1}><Icon name={tile.icon} size={16} /> {tileDisplayLabel(tile.label)}</li>)}</ol>
}

export function Tutorial({ firstTime, onClose, game }: { firstTime: boolean; onClose: () => void; game?: GameState }) {
  const [index, setIndex] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const living = livingPresentation(game)
  const rules=game?rulesForGame(game):MULTI_COURSE_RULES
  const step = index === 4 ? { ...steps[index], title: 'Chủ động cho mỗi vòng mới', text: living.text,
    detail: `${living.detail} ${steps[index].detail}` } : steps[index]
  const navigate = (next: number) => { setIndex(next); heading.current?.focus({ preventScroll: true }) }
  return <Modal title={firstTime ? 'Hướng dẫn chơi' : 'Sổ tay hành trình'} className="tutorial" onClose={firstTime ? undefined : onClose}>
    <div className="tutorial-topline"><span className="section-kicker">{firstTime ? 'CHÀO MỪNG TÂN BINH' : 'SỔ TAY HÀNH TRÌNH'}</span>
      {firstTime && <button className="text-button" onClick={onClose}>Bỏ qua hướng dẫn</button>}</div>
    {game && businessRulesForGame(game) === 'v2.4-customer-preferences' && <details className="tutorial-preference">
      <summary>Thị hiếu vòng hiện tại</summary><CustomerPreferenceCard game={game} showUpgrades />
    </details>}
    <div className="tutorial-progress" role="progressbar" aria-label="Tiến độ hướng dẫn" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
      {steps.map((item, i) => <span key={item.title} className={i <= index ? 'visited' : ''} data-current={i === index} />)}</div>
    <div className={`tutorial-scene scene-${index}`} aria-hidden="true"><span><Icon name={['flag', 'bank', 'bolt', 'leaf', 'wallet', 'check'][index]} size={40} /></span><b>XOAY VÒNG TIẾN LUI</b></div>
    <section className="tutorial-content" aria-live="polite" aria-atomic="true">
      <span className="section-kicker">{index + 1} / {steps.length} · {step.tag}</span>
      <h2 ref={heading} tabIndex={-1}>{step.title}</h2><p><GlossaryText text={step.text} /></p>
      {index === 0 && <div className="tutorial-goal"><div><small>Vốn ban đầu</small><strong>50 triệu</strong></div><span aria-hidden="true">→</span><div><small>Mục tiêu sau 4 vòng</small><strong>90 triệu</strong></div></div>}
      {index === 1 && <div className="tutorial-tiles">{[['🏦', 'Ngân hàng', 'Gửi tiết kiệm'], ['📈', 'Thị trường', 'Mua tài sản'], ['🧋', 'Kinh doanh', 'Mở & nâng quán'], ['📚', 'Khóa học', 'Tăng lương'], ['🧾', living.periodic ? 'Xuất phát' : 'Sinh hoạt', living.periodic ? 'Lương & sinh hoạt' : 'Trả chi phí'], ['⚡', 'Biến cố', 'Đón bất ngờ']].map(([icon, title, text]) => <div key={title}><span aria-hidden="true">{icon}</span><strong>{title}</strong><small>{text}</small></div>)}</div>}
      {index === 2 && <ol className="tutorial-turn">{['Gieo xúc xắc', 'Nhân vật di chuyển', 'Khám phá ô dừng', 'Chọn hành động'].map((title, i) => <li key={title}><b>{i + 1}</b>{title}</li>)}</ol>}
      {index === 3 && <ul className="tutorial-earn"><li><span>🏦 Tiết kiệm</span><b>Nhận gốc + lãi khi đến hạn</b></li><li><span>🧾 Trái phiếu</span><b>Chọn tổ chức phát hành · Theo dõi khả năng trả nợ</b></li><li><span>📈 Cổ phiếu</span><b>Mua/Bán ở ô · Vẫn bán ô Xuất phát</b></li><li><span>🧋 Mở quán</span><b>+{money(ECONOMY.business.baseIncome)} / lần qua ô Xuất phát</b></li><li><span>📚 Khóa học</span><b>{!game||isMultiCourse(game)?'6M / +2M · 10M / +4M mỗi lần qua ô Xuất phát':`Lương +${money(rules.courseBoost!)} / vòng`}</b></li></ul>}
      {index === 4 && <><div className="tutorial-bill"><span>{living.label}</span><strong>{money(living.amount)}</strong></div><p className="tutorial-tip">Chừa tiền sinh hoạt · Dự phòng biến cố cá nhân</p></>}
      {index === 5 && <div className="tutorial-goal"><div><small>Một mục tiêu</small><strong>90 triệu</strong></div><div><small>Thời hạn</small><strong>4 vòng</strong></div></div>}
      <details key={index}><summary>Luật chi tiết</summary><p><GlossaryText text={step.detail} /></p>
        {index === 1 && <><p>{living.text}</p><BoardGuide game={game} /></>}
        {index === 3 && <p>Kỳ hạn 1 / 2 / 3 kỳ (mỗi kỳ là một lần qua ô Xuất phát): lãi đơn cuối kỳ lần lượt 4% / 10% / 18% tiền gốc. Giá thị trường là dữ liệu hư cấu trong trò chơi; không phải giá giao dịch thực tế.</p>}
        {index === 3 && <p>Đầu vòng đọc Bản tin thị trường; tại ô mua mở “Xem tín hiệu thị trường”. Cuối vòng, “Dự báo và thực tế” cho biết giá đã đổi ra sao, không phải lãi đầu tư của bạn. Quán vẫn dùng sở thích khách, không dùng bảng dự báo này.</p>}
        {index === 3 && <p>Trái phiếu hiện tại: An Tâm hạng AA, lãi trái phiếu định kỳ 4,5%; Bứt Phá hạng B, lãi trái phiếu định kỳ 10% mỗi lần qua ô Xuất phát; đến hạn sau hai lần qua ô Xuất phát. Xếp hạng tín nhiệm chỉ có trong trò chơi. Giá mua khác mệnh giá; lãi trái phiếu định kỳ tính trên mệnh giá còn giữ. Chậm trả là khoản chờ nhận, chưa vào ví; mất vốn là phần không thu hồi. Nếu vỡ nợ, lãi trái phiếu định kỳ chưa trả mất toàn bộ, gốc chỉ thu hồi 80% / 50% ở lần qua ô Xuất phát tiếp theo. Bán từng khoản chịu phí 1,5%; tổ chức phát hành vỡ nợ không có giá bán. Cuối vòng 4 chỉ tính tiền đã nhận và giá bán khả dụng, không hứa trả sớm hoặc thu hồi sau ván. Phiên V2.4 đã lưu giữ trái phiếu cũ: lãi trái phiếu định kỳ 5%, không có vỡ nợ ngẫu nhiên.</p>}
        {index === 5 && <><p>Trò chơi tính nguồn tiền có thể huy động theo báo giá hợp lệ, không tự tạo giao dịch thanh lý toàn bộ tài sản.</p><p>AI Coach là gợi ý tùy chọn, có thể không sẵn sàng hoặc nhận xét sai. Hãy đối chiếu với nhật ký ván chơi.</p></>}
      </details>
    </section>
    <footer className="tutorial-actions"><button className="button secondary" disabled={index === 0} onClick={() => navigate(index - 1)}>Quay lại</button>
      <button className="button primary" onClick={() => index === steps.length - 1 ? onClose() : navigate(index + 1)}>{index === steps.length - 1 ? firstTime ? 'Sẵn sàng chơi!' : 'Đóng sổ tay' : 'Tiếp theo →'}</button></footer>
  </Modal>
}
