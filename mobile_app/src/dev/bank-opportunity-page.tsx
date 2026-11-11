import { useState } from 'react'
import { money } from '../../../src/game/format.ts'
import { compareBankOpportunity } from './bank-opportunity.ts'
import type { BankChoice } from './bank-opportunity.ts'
import './bank-opportunity.css'

type Result = ReturnType<typeof compareBankOpportunity>
function Comparison({ result }: { result: Result }) {
  if (result.status !== 'supported') return <section role="alert" className="notice">
    <h2>Chưa đủ điều kiện so sánh</h2>
    <p>{result.reason === 'principal-invalid' ? 'Chọn số tiền nguyên từ 1 đến 50.000.000 ₫.'
      : 'Ví dụ này chưa chứng minh được cùng điều kiện và cùng mốc. Chưa hiển thị chênh lệch tiền.'}</p>
  </section>
  const actual = result.actualChoice === 'cash' ? result.cash : result.deposit
  const alternative = result.actualChoice === 'cash' ? result.deposit : result.cash
  const deposited = result.actualChoice === 'deposit'
  return <section aria-label="Kết quả so sánh" aria-live="polite">
    <div className="checkpoint"><span>MỐC SO SÁNH CHUNG</span><h2>Sau quyết toán START vòng {result.checkpoint.lap}</h2>
      <p>Cùng {money(result.principal)} vốn phân bổ · cùng lần gieo tiếp theo.</p></div>
    <div className="outcomes">
      <article className="actual" aria-label="Bạn chọn trong ví dụ"><span className="eyebrow">BẠN CHỌN TRONG VÍ DỤ</span>
        <h3>{deposited ? 'Gửi tiết kiệm' : 'Giữ tiền mặt'}</h3><p>Tiền mặt sau quyết toán</p><strong>{money(actual.netCash)}</strong>
        <p>Còn dùng ngay sau lựa chọn: <b>{money(actual.initialCash)}</b></p></article>
      <article className="alternative" aria-label="Phương án thay thế hợp lệ"><span className="eyebrow">NẾU CHỌN KHÁC</span>
        <h3>{deposited ? 'Giữ tiền mặt' : 'Gửi tiết kiệm'}</h3><p>Tiền mặt sau quyết toán</p><strong>{money(alternative.netCash)}</strong>
        <p>Còn dùng ngay sau lựa chọn: <b>{money(alternative.initialCash)}</b></p></article>
    </div>
    <section className="lesson"><h2>{deposited ? 'Khoản lãi đã nhận trong mô phỏng' : 'Khoản lãi có thể đã bỏ lỡ'}</h2>
      <strong data-testid="opportunity-difference">{money(result.realizedInterest)}</strong>
      <p>{deposited ? 'Gửi tiết kiệm tạo thêm khoản tiền này so với giữ cùng số vốn bằng tiền mặt.'
        : 'Nếu gửi cùng số vốn theo hợp đồng đã có lúc chọn, bạn nhận thêm khoản tiền này ở mốc trên.'}</p>
      <p>Engine đã trả lại {money(result.deposit.principalReturned)} tiền gốc và {money(result.realizedInterest)} tiền lãi. Phí gửi/đáo hạn: {money(result.fees)}.</p>
      <p>Cả hai cùng nhận {money(result.before.recurringIncome)} lương và trả {money(result.commonPaid)} chi phí đến hạn; nợ và nghĩa vụ còn lại đều bằng 0.</p>
    </section>
    <section className="liquidity"><h2>Đổi lại, tiền bị khóa</h2>
      <p>Nhánh gửi chỉ còn <b>{money(result.deposit.liquidBuffer)}</b> dùng ngay. {money(result.principal)} bị khóa đến START kế tiếp; không được rút tự nguyện trước hạn.</p>
      <p>Ở ví dụ ô cuối này, đáo hạn xảy ra ngay sau lần gieo tiếp theo. Nếu một tình huống khác cần rút bắt buộc trước hạn, khoản gửi sẽ mất lãi; kết quả trên không áp dụng.</p>
      {result.deposit.liquidBuffer === 0 && <p className="notice">Gửi hết vốn khiến tiền mặt về 0. Ví dụ này không có khoản chi trước đáo hạn; không suy ra gửi hết tiền luôn an toàn.</p>}
    </section>
    <section className="limits"><h2>Kết quả này có nghĩa gì?</h2>
      <p>Đây là kết quả có điều kiện, không phải bằng chứng giữ tiền mặt là quyết định sai. Nhu cầu dùng tiền và lựa chọn khác có thể làm thay đổi đánh giá.</p>
      <p>Lãi {(result.deposit.rate * 100).toFixed(0)}% theo luật trò chơi cho kỳ hạn đến START kế tiếp, không phải lãi suất một năm hay một lượt ngoài đời. Không chọn seed hoặc phương án theo giá tương lai.</p>
      <p>Chỉ so sánh gửi kỳ hạn 1 ở ô Ngân hàng cuối vòng. Trước đó, ví dụ bỏ qua đầu tư tùy chọn và trả chi phí bắt buộc; dừng sau quyết toán, trước sự kiện tiếp theo. Chưa mô phỏng bốn vòng.</p>
    </section>
  </section>
}

export function BankOpportunityPage() {
  const [amount, setAmount] = useState('5000000')
  const [actual, setActual] = useState<BankChoice>('cash')
  const [result, setResult] = useState<Result | null>(null)
  return <main>
    <header><span className="eyebrow">EXE · PREMIUM WHAT-IF · DEV</span><h1>Giữ tiền hay gửi tiết kiệm?</h1>
      <p>Một khoản vốn. Hai lựa chọn hợp lệ. Một mốc so sánh.</p></header>
    <aside className="notice">Ví dụ độc lập để Owner review. Không phải lựa chọn trong ván của bạn; không lưu hoặc thay đổi ván đang chơi.</aside>
    <form noValidate onSubmit={event => { event.preventDefault(); setResult(compareBankOpportunity({ amount: Number(amount), actual })) }}>
      <h2>Chọn trước khi xem kết quả</h2><p>Đang ở ô Ngân hàng cuối vòng 1, có 50.000.000 ₫ tiền mặt. Hợp đồng kỳ hạn 1: 4%, đáo hạn tại START kế tiếp.</p>
      <label htmlFor="principal">Cùng số vốn để giữ hoặc gửi (₫)</label>
      <input id="principal" inputMode="numeric" type="number" min="1" max="50000000" step="1" value={amount}
        onChange={event => { setAmount(event.target.value); setResult(null) }}/>
      <label htmlFor="actual-choice">Bạn chọn trong ví dụ</label><select id="actual-choice" value={actual}
        onChange={event => { setActual(event.target.value as BankChoice); setResult(null) }}>
        <option value="cash">Giữ tiền mặt</option><option value="deposit">Gửi tiết kiệm kỳ hạn 1</option>
      </select><button type="submit">Xem so sánh tại START</button>
    </form>
    {result && <Comparison result={result}/>}
    <footer>Giải thích từ dữ kiện engine đã kiểm chứng · Không gọi AI Companion hoặc dịch vụ AI.</footer>
  </main>
}

