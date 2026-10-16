import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { GoalChecks } from '../../../src/components/GoalChecks'
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard'
import { BoardGuide } from './Tutorial'
import { rulesForGame, MULTI_COURSE_RULES, isCoreMvp, isMultiCourse } from '../../../src/game/rules-profile'
import { livingPresentation } from '../game/living-presentation'
import type { GameState } from '../../../src/game/types'
import { savingsProfileForGame, savingsProfileForMode } from '../../../src/game/savings'
import { tileTradingEnabled } from '../../../src/game/encounters'
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board'
import { money } from '../../../src/game/format'

const tabs=['Mục tiêu','Bàn cờ','Lượt chơi','Đầu tư','Rủi ro','START']
export function RulebookModal({game,onClose}:{game?:GameState;onClose:()=>void}){
  const [tab,setTab]=useState(0),rules=game?rulesForGame(game):MULTI_COURSE_RULES,living=livingPresentation(game),rates=(game?savingsProfileForGame(game):savingsProfileForMode('experimental-b')).rates,legacy=!!game&&!isCoreMvp(game)
  return <Modal title="Sổ tay hành trình" onClose={onClose} className="rulebook-modal">
    <h2>Sổ tay hành trình</h2>
    <div className="rulebook-tabs" role="tablist" aria-label="Chủ đề sổ tay">{tabs.map((name,i)=><button key={name} id={`rule-tab-${i}`} role="tab" aria-selected={tab===i} aria-controls={`rule-panel-${i}`} onClick={()=>setTab(i)}>{name}</button>)}</div>
    <section role="tabpanel" id={`rule-panel-${tab}`} aria-labelledby={`rule-tab-${tab}`}>
      {tab===0&&<><h3>Tích lũy đủ 90 triệu trong {game?.totalLaps??4} vòng</h3><GoalChecks game={game}/><p>Bắt đầu 50 triệu tự phân bổ. Không bắt buộc dùng mọi loại đầu tư hoặc giữ riêng 10 triệu tiền mặt. Bạn tự cân nhắc lợi nhuận, dự phòng và thanh khoản.</p></>}
      {tab===1&&<><h3>Bàn {game?.boardLayout??'B18'} · {game?boardFor(game).length:MULTI_COURSE_B18_BOARD.length} ô</h3><BoardGuide game={game}/><p>{living.text} Chỉ ô dừng kích hoạt; đi ngang không kích hoạt.</p></>}
      {tab===2&&<><h3>Mỗi lần ghé là một quyết định mới</h3><ol><li>Đọc bản tin thị trường.</li><li>Gieo D6 và đi theo thứ tự ô.</li><li>Chọn hành động tại ô dừng.</li><li>Qua START để quyết toán vòng.</li></ol><p>{!game||tileTradingEnabled(game)?'Cổ phiếu/Trái phiếu/Vàng: Mua hoặc Bán hoặc Bỏ qua ngay tại ô.':'Ván lịch sử: mua tại ô, bán tại START hoặc funding hợp lệ.'} Tối đa một giao dịch thành công; lỗi không mất quyền, lần ghé sau vẫn giao dịch được. Giá không đổi vì mua/bán.</p></>}
      {tab===3&&legacy&&<><h3>Tiếp tục ván theo luật đã lưu</h3><p>Tiết kiệm kỳ hạn 1 / 2 / 3 START: lãi {([1,2,3] as const).map(term=>rates[term]*100).join(' / ')}% mỗi START. Khóa học {money(rules.courseCost!)}, tăng lương {money(rules.courseBoost!)}.</p><p>Cổ phiếu và Vàng phụ thuộc giá, chịu phí khi bán; Vàng còn chịu chênh lệch mua/bán. Hợp đồng trái phiếu, khoản gửi và quán giữ nguyên luật của ván này. Mở Ví để xem báo giá, coupon, kỳ hạn và các hành động được phép.</p></>}
      {tab===3&&!legacy&&<><h3>Chọn cách phân bổ</h3><p>Ngân hàng: gửi một khoản mới mỗi lần ghé, kỳ hạn 1 / 2 / 3 START. Lãi {([1,2,3] as const).map(term=>rates[term]*100).join(' / ')}% mỗi START, lãi đơn nhận cuối kỳ; không tự tái tục. Rút sớm khi funding phải rút cả lot, mất lãi chưa nhận.</p><p>Stocks và Gold: lợi nhuận phụ thuộc giá, có thể lỗ. Gold không có thu nhập định kỳ, bán chịu spread 3% và phí 1% sau spread. Stocks phí bán 1%.</p><p>Bond V2.5: An Tâm coupon 4,5%, Bứt Phá 10%, kỳ hạn 2 START; coupon cao đi cùng rủi ro chậm trả/mất vốn. Coupon/gốc chưa nhận chưa phải tiền mặt; default không có giá bán; phí bán 1,5%.</p>{!game||isMultiCourse(game)?<p>Hai khóa độc lập: cơ bản 6M / +2M và nâng cao 10M / +4M mỗi START, bất kỳ thứ tự. Mỗi khóa học một lần; mỗi lần ghé mua tối đa một khóa bằng tiền mặt hiện có, không vay mới để học. Tăng lương từ START kế tiếp, cộng dồn tới 20M; học phí không hoàn lại. Có thể bỏ qua. Ô Đầu tư bản thân: 5/8/13; ô 16 là Trái phiếu.</p>:<p>Course {money(rules.courseCost!)}, mua một lần, lương +{money(rules.courseBoost!)}/START từ lần qua START tiếp theo. Sau mua, ghé lại chỉ tiếp tục.</p>}<p>Business: mở 20M, nâng 5M/tầng từ lần ghé tiếp theo, tối đa 6 tầng. Nền 3M + 700 nghìn/tầng + 1M/tầng hợp sở thích tại START. Chỉ bán tại ô Business; giá chịu thị trường/khấu hao, không tự thanh lý cuối ván.</p>{game?.businessRulesVersion==='v2.4-customer-preferences'&&<CustomerPreferenceCard game={game} showUpgrades/>}</>}
      {tab===4&&<><h3>Dự phòng là lựa chọn của bạn</h3><p>{living.text}</p><p>Biến cố cá nhân giữ ba tình huống: Y tế trả 5M hoặc hẹn 6M; sửa xe 4M hoặc 1M ngay + 4M cuối vòng; gia đình 3M hoặc hẹn 3,5M. Xem nghĩa vụ trước khi chọn.</p><p>Tiền mặt dùng trước; thiếu thì chọn rút savings, bán financial hoặc vay phần thiếu trong hạn mức 30M. Vay lãi 10%; vay ở START cuối cộng lãi vào nợ ngay. Business không dùng funding. Hết nguồn hợp lệ thì phá sản.</p><p>Không cần giữ một mức reserve cố định. Hãy cân nhắc vốn bị khóa, phí/spread và những khoản có thể phải trả trước khi đầu tư.</p></>}
      {tab===5&&legacy&&<><h3>Quyết toán theo ván đã lưu</h3><p>{living.text}</p><p>Thị trường, lương, kinh doanh, đáo hạn/coupon và các khoản đến hạn được xử lý theo phiên bản của ván. START vẫn cho bán tài sản tài chính; quán chỉ bán tại ô Kinh doanh. Giá trị huy động hợp lệ trừ nợ và nghĩa vụ; không tự thanh lý tài sản.</p></>}{tab===5&&!legacy&&<><h3>Khi hoàn thành một vòng</h3><p>Thị trường → lương {money(rules.recurringIncome)} → Business → savings đáo hạn/coupon → sinh hoạt {money(living.amount)} → nợ/nghĩa vụ → quyền bán tại START.</p><p>START cuối vẫn cho bán tài sản tài chính; Business chỉ bán ở ô Business. Sau đó xét mục tiêu 90M, không tự bán tài sản, không tính khoản phải thu chưa chắc chắn. Bản tin và báo cáo cuối vòng dùng dữ liệu đã xảy ra, không hứa lợi nhuận.</p></>}
    </section>
    <button className="button primary full-button" onClick={onClose}>Đóng sổ tay</button>
  </Modal>
}
