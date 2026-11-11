import { useId, useState } from 'react'
import type { createInGameAiController, InGameAiView } from '../../game/what-if-ai/in-game-controller.ts'
import type { DecisionParameters } from '../../game/what-if-ai/orchestrator.ts'
import { alternativeLabel } from '../../game/what-if-ai/orchestrator.ts'
import { readVndAmount } from '../../game/what-if-ai/natural-language.ts'

type Controller = ReturnType<typeof createInGameAiController>
export function FlexibleChoices({ view, controller, pending }: { view: InGameAiView; controller: Controller; pending: boolean }) {
  const history = useId(), alternatives = useId()
  return <>
    <label htmlFor={history}>Quyết định lịch sử</label>
    <select id={history} data-history-selector value={view.selectedSequence ?? ''} disabled={pending} onChange={event => { void controller.selectHistory(Number(event.target.value)) }}>
      <option value="" disabled>Chọn một quyết định</option>
      {view.history?.map(entry => <option key={entry.sequence} value={entry.sequence}>
        Quyết định {entry.sequence} · Vòng {entry.lap}, lượt {entry.turn} · {entry.description ?? entry.action}
      </option>)}
    </select>
    {!!view.historyTotal && <p>{(view.historyOffset ?? 0) + 1}–{(view.historyOffset ?? 0) + (view.history?.length ?? 0)} / {view.historyTotal} quyết định</p>}
    <div className="in-game-ai-actions">
      {!!view.historyOffset && <button type="button" disabled={pending} onClick={() => { void controller.historyPage(Math.max(0, view.historyOffset! - 8)) }}>Trang quyết định trước</button>}
      {view.historyNext != null && <button type="button" disabled={pending} onClick={() => { void controller.historyPage(view.historyNext!) }}>Trang quyết định sau</button>}
    </div>
    {view.selectedSequence && view.controls && ['stocks', 'bonds', 'bank'].includes(view.kind) &&
      <ParameterEditor key={`${view.kind}:${view.selectedSequence}`} view={view} controller={controller} pending={pending} />}
    {view.selectedSequence && <>
      <label htmlFor={alternatives}>Phương án đã xác minh hợp lệ</label>
      <select id={alternatives} data-parameter="preferenceId" data-verified-alternative value="" disabled={pending || !view.catalog.length} onChange={event => {
        const choice = view.catalog[Number(event.target.value)]
        if (choice) controller.choose(choice)
      }}>
        <option value="" disabled>Chọn phương án để xác nhận</option>
        {view.catalog.map((choice, index) => <option key={choice.alternativeId} value={index}>{alternativeLabel(choice)}</option>)}
      </select>
      {!pending && !view.catalog.length && !view.controls && !view.alternativesNext && <p>Không có phương án khác đã xác minh cho quyết định này. Hãy chọn một quyết định khác.</p>}
      <div className="in-game-ai-actions">
        {!!view.alternativesOffset && <button type="button" disabled={pending} onClick={() => { void controller.alternativesPage(Math.max(0, view.alternativesOffset! - 8)) }}>Trang phương án trước</button>}
        {view.alternativesNext != null && <button type="button" disabled={pending} onClick={() => { void controller.alternativesPage(view.alternativesNext!) }}>Trang phương án sau</button>}
      </div>
    </>}
  </>
}

function ParameterEditor({ view, controller, pending }: { view: InGameAiView; controller: Controller; pending: boolean }) {
  const controls = view.controls!
  const selected = view.catalog.length === 1 ? view.catalog[0].parameters : undefined
  const natural = view.natural
  const [operation, setOperation] = useState<'buy' | 'sell' | 'deposit'>(selected?.operation
    ?? (view.kind === 'bank' ? 'deposit' : natural?.action === 'sell' ? 'sell' : 'buy'))
  const [amount, setAmount] = useState(selected ? String(selected.amount) : natural?.amount ? String(natural.amount) : '')
  const [symbol, setSymbol] = useState(selected?.symbolId ?? natural?.symbolId ?? (natural ? '' : controls.symbols[0] ?? ''))
  const [issuer, setIssuer] = useState(selected?.issuerId ?? natural?.issuerId ?? (natural ? '' : controls.issuers[0] ?? ''))
  const [lot, setLot] = useState(selected?.lotId ?? natural?.lotId ?? (natural ? '' : controls.lots[0]?.id ?? ''))
  const [term, setTerm] = useState<1 | 2 | 3 | ''>(selected?.term ?? natural?.term ?? (natural ? '' : 1))
  const group = useId(), amountId = useId(), targetId = useId()
  const numeric = readVndAmount(amount)
  const maximum = operation !== 'sell' ? controls.cash : view.kind === 'stocks' ? controls.stockSellMax
    : controls.lots.find(item => item.id === lot)?.available ?? 0
  const target = view.kind === 'stocks' ? controls.symbols.includes(symbol)
    : view.kind === 'bonds' ? operation === 'buy' ? controls.issuers.includes(issuer) : controls.lots.some(item => item.id === lot)
      : term !== '' && controls.terms.includes(term)
  function changed() { controller.invalidateChoices() }
  return <fieldset>
    <legend>Thiết lập phương án để kiểm tra</legend>
    {view.kind !== 'bank' && <>
      <label htmlFor={group}>Hành động</label>
      <select id={group} value={operation} disabled={pending} onChange={event => { setOperation(event.target.value as 'buy' | 'sell'); changed() }}>
        <option value="buy">Mua</option><option value="sell">Bán theo số tiền</option>
      </select>
    </>}
    {view.kind === 'stocks' && <>
      <label htmlFor={targetId}>Mã cổ phiếu</label>
      <select id={targetId} data-parameter="symbolId" value={controls.symbols.includes(symbol) ? symbol : ''} disabled={pending} onChange={event => { setSymbol(event.target.value); changed() }}>
        <option value="" disabled>Chọn mã cổ phiếu</option>
        {controls.symbols.map(value => <option key={value}>{value}</option>)}
      </select>
    </>}
    {view.kind === 'bonds' && <>
      <label htmlFor={targetId}>{operation === 'buy' ? 'Tổ chức phát hành' : 'Khoản trái phiếu'}</label>
      <select id={targetId} data-parameter={operation === 'buy' ? 'issuerId' : 'lotId'} value={target ? operation === 'buy' ? issuer : lot : ''} disabled={pending} onChange={event => {
        if (operation === 'buy') setIssuer(event.target.value)
        else setLot(event.target.value)
        changed()
      }}>
        <option value="" disabled>Chọn {operation === 'buy' ? 'tổ chức phát hành' : 'khoản trái phiếu'}</option>
        {(operation === 'buy' ? controls.issuers : controls.lots.map(item => item.id)).map(value => <option key={value} value={value}>
          {value === 'an-tam' ? 'An Tâm' : value === 'but-pha' ? 'Bứt Phá' : value}
        </option>)}
      </select>
    </>}
    {view.kind === 'bank' && <>
      <label htmlFor={targetId}>Kỳ hạn START</label>
      <select id={targetId} data-parameter="term" value={term} disabled={pending} onChange={event => { setTerm(Number(event.target.value) as 1 | 2 | 3); changed() }}>
        <option value="" disabled>Chọn kỳ hạn</option>
        {controls.terms.map(value => <option key={value} value={value}>{value} START</option>)}
      </select>
    </>}
    <label htmlFor={amountId}>Số tiền VND</label>
    <input id={amountId} data-parameter="amount" type="text" inputMode="decimal" maxLength={24} value={amount} disabled={pending}
      onChange={event => { setAmount(event.target.value); changed() }} />
    <p>{amount && numeric === undefined ? 'Nhập số nguyên dương, ví dụ 1250000 hoặc 1.250.000.'
      : numeric !== undefined && numeric > maximum ? 'Số tiền vượt số dư khả dụng ở lượt đã chọn.'
        : `Giới hạn ${new Intl.NumberFormat('vi-VN').format(maximum)} ₫ ở lượt đã chọn.`}</p>
    <button type="button" disabled={pending || !target || numeric === undefined || numeric > maximum} onClick={() => {
      if (numeric === undefined) return
      let parameters: DecisionParameters
      if (view.kind === 'bank') { if (!term) return; parameters = { operation: 'deposit', amount: numeric, term } }
      else if (view.kind === 'stocks') parameters = { operation, amount: numeric, symbolId: symbol }
      else parameters = { operation, amount: numeric, ...(operation === 'buy' ? { issuerId: issuer } : { lotId: lot }) }
      void controller.probe(parameters)
    }}>Xác minh phương án</button>
  </fieldset>
}
