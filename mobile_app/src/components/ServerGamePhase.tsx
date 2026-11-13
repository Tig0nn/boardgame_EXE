import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ASSETS, SCENARIOS } from '../../../src/data/config'
import { bondIssuer } from '../../../src/data/bond-issuers'
import { CUSTOMER_PREFERENCES } from '../../../src/data/customer-preferences'
import { localizeNarrative } from '../../../src/components/glossary'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { SavingsTerms } from '../../../src/components/SavingsTerms'
import { money, signedMoney } from '../../../src/game/format'
import type { FundingSource, RebalanceAction, Term, TradableAsset } from '../../../src/game/types'
import type { MobileCommand } from '../game/session'
import { actionRequest, apiMessage, ApiError } from '../game/server-session'
import type { createGameApi, Quote, SessionDetail } from '../game/server-session'
import { GamifiedModal } from './GamifiedModal'

type Choice = {
  id: string
  label: string
  min: number
  max: number
  defaultAmount?: number
  term?: boolean
  command: (amount: number, term: Term) => MobileCommand
}

const sources: Record<FundingSource, string> = {
  debt: 'Vay nợ', savings: 'Rút tiết kiệm', stocks: 'Bán cổ phiếu', bonds: 'Bán trái phiếu', gold: 'Bán vàng',
}

function tradingChoices({ state }: SessionDetail): Choice[] {
  const trade = (id: string, label: string, payload: Omit<RebalanceAction, 'amount'>, max: number, min = 1): Choice =>
    ({ id, label, min, max, term: payload.kind === 'deposit', command: (amount, term) => ({
      type: 'trade', action: { ...payload, amount, ...(payload.kind === 'deposit' ? { term } : {}) },
    }) })
  const sell = (asset: TradableAsset, max: number, symbolId?: string, lotId?: string) =>
    trade(['sell', asset, symbolId, lotId].filter(Boolean).join('-'),
      'Bán ' + ASSETS[asset].label.toLocaleLowerCase('vi') + (symbolId || lotId ? ' · ' + (symbolId ?? lotId) : ''),
      { kind: 'sell', asset, symbolId, lotId }, max)
  const options: Choice[] = []
  if (state.phase === 'rebalancing') {
    for (const sale of state.start.sales) {
      options.push(sell(sale.asset, sale.maxAmount, 'symbolId' in sale ? sale.symbolId : undefined, 'lotId' in sale ? sale.lotId : undefined))
    }
    if (state.start.canRepay) options.push(trade('repay', 'Trả nợ', { kind: 'repay' }, Math.min(state.portfolio.debt, state.portfolio.cash)))
    return options
  }
  if (state.bank.canDeposit) options.push(trade('deposit', 'Gửi tiết kiệm', { kind: 'deposit' }, state.portfolio.cash))
  for (const action of state.business.actions) {
    if (action.kind === 'upgrade') {
      for (const item of CUSTOMER_PREFERENCES) options.push(trade('upgrade-' + item.id,
        'Nâng cấp · ' + item.label, { ...action, customerPreferenceId: item.id }, action.amount, action.amount))
    } else options.push(trade(action.kind + '-business', action.kind === 'buy' ? 'Mua cơ sở kinh doanh' : 'Bán cơ sở kinh doanh', action, action.amount, action.amount))
  }
  const asset = state.tradingAsset
  if (!asset) return options
  const cash = state.portfolio.cash
  const buy = (label: string, id: string, fields: Partial<RebalanceAction> = {}) => {
    if (cash > 0) options.push(trade(id, label, { kind: 'buy', asset, ...fields }, cash))
  }
  if (asset === 'gold') {
    buy('Mua vàng', 'buy-gold')
    options.push(sell(asset, state.portfolio.gold))
  } else if (asset === 'stocks') {
    for (const stock of state.market.stocks) {
      buy('Mua cổ phiếu · ' + stock.id, 'buy-' + stock.id, { symbolId: stock.id })
      const units = state.holdings.stocks[stock.id]?.units ?? 0
      options.push(sell(asset, Math.min(state.portfolio.stocks, Math.round(stock.currentPrice * units)), stock.id))
    }
  } else {
    for (const issuer of state.market.bonds) {
      if (issuer.status === 'performing') buy('Mua trái phiếu · ' + bondIssuer(issuer.id).name, 'buy-' + issuer.id, { issuerId: issuer.id })
    }
    for (const lot of state.holdings.bonds) {
      const issuer = state.market.bonds.find(item => item.id === lot.issuerId)
      if (lot.status === 'active' && issuer && (issuer.status === 'performing' || issuer.status === 'delayed')) {
        options.push(sell(asset, Math.round(lot.units * issuer.currentPrice), undefined, lot.id))
      }
    }
  }
  return options.filter(option => option.max >= option.min)
}

function fundingChoices({ state }: SessionDetail): Choice[] {
  return state.fundingOptions.map(({ source, minAmount, maxAmount, lotId }) => ({
    id: [source, lotId].filter(Boolean).join('-'),
    label: sources[source] + (lotId ? ' · ' + lotId : ''),
    min: minAmount, max: maxAmount,
    defaultAmount: Math.min(maxAmount, Math.max(minAmount, state.pendingPayment?.remaining ?? minAmount)),
    command: amount => ({ type: 'fund', source, amount, lotId }),
  }))
}

function TransactionForm({ choice, detail, api, send, locked, refresh }: {
  choice: Choice; detail: SessionDetail; api: ReturnType<typeof createGameApi>; send: (command: MobileCommand) => void
  locked: boolean; refresh: () => void
}) {
  const [amount, setAmount] = useState(choice.defaultAmount ?? (choice.min === choice.max ? choice.min : Math.min(choice.max, 1_000_000)))
  const [term, setTerm] = useState<Term>(1)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoted, setQuoted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const valid = Number.isSafeInteger(amount) && amount >= choice.min && amount <= choice.max
  const reset = () => { setQuoted(false); setQuote(null); setError('') }
  const preview = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || locked || !valid) return
    const command = choice.command(amount, term)
    if (quoted) { send(command); return }
    const request = api.quote(detail.session.id, actionRequest(command, detail.session.stateVersion))
    if (!request) { send(command); return }
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const { quote: value } = await request
      setQuote(value)
      setQuoted(true)
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 409) refresh()
      else setError(apiMessage(problem))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const command = choice.command(amount, term)
  const requiresQuote = command.type === 'trade' || (command.type === 'fund' && ['savings', 'debt'].includes(command.source))
  return <form onSubmit={preview}>
    <fieldset disabled={busy || locked}>
      <label htmlFor="server-amount">Số tiền (VND)</label>
      <MoneyInput id="server-amount" amount={amount} onChange={value => { setAmount(value); reset() }} invalid={!valid} />
      {choice.term && <SavingsTerms name="server-term" term={term} rates={detail.state.bank.savingsRates} onChange={value => { setTerm(value); reset() }} />}
      {quote && <div role="status">
        <p>Tiền mặt sau giao dịch <strong>{money(quote.cashAfter)}</strong></p>
        {quote.cashReceived !== undefined && <p>Thực nhận {money(quote.cashReceived)}</p>}
        {quote.cashPaid !== undefined && <p>Thanh toán {money(quote.cashPaid)}</p>}
        {!!quote.fee && <p>Phí {money(quote.fee)}</p>}
        {!!quote.spread && <p>Chênh lệch mua bán {money(quote.spread)}</p>}
        {quote.repayment && <p>Tiền lãi trả {money(quote.repayment.interest)}</p>}
        {quote.deposit && <p>Lãi khi đáo hạn {money(quote.deposit.interestAtMaturity)}</p>}
        {quote.funding && <p>Lãi chưa nhận bị mất {money(quote.funding.lostInterest)}</p>}
      </div>}
      <button className="button primary" disabled={!valid}>{busy ? 'Đang lấy báo giá…' : quoted || !requiresQuote ? 'Xác nhận' : 'Xem báo giá'}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>
}

function Transactions({ choices, ...props }: Omit<Parameters<typeof TransactionForm>[0], 'choice'> & { choices: Choice[] }) {
  const [selected, setSelected] = useState(choices[0]?.id ?? '')
  const choice = choices.find(item => item.id === selected) ?? choices[0]
  if (!choice) return null
  return <section aria-label="Giao dịch">
    <label htmlFor="server-transaction">Thao tác</label>
    <select id="server-transaction" className="text-input" value={choice.id} disabled={props.locked} onChange={event => setSelected(event.target.value)}>
      {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <TransactionForm key={choice.id} choice={choice} {...props} />
  </section>
}

export function ServerGamePhase({ detail, api, send, locked, onHome, onNew, refresh, coach }: {
  detail: SessionDetail; api: ReturnType<typeof createGameApi>; send: (command: MobileCommand) => void
  locked: boolean; onHome: () => void; onNew: () => void; refresh: () => void; coach?: ReactNode
}) {
  const { state, result, session } = detail
  const advance = () => send({ type: 'advance' })
  const transactionProps = { detail, api, send, locked, refresh }
  const lap = 'VÒNG ' + state.lap + ' / ' + state.totalLaps
  switch (state.phase) {
    case 'forecast': {
      const scenario = SCENARIOS.find(item => item.id === state.scenarioId)
      return <GamifiedModal badgeText={lap} title={scenario?.label ?? 'Bản tin thị trường'}
        primaryAction={{ label: 'Bắt đầu vòng ' + state.lap, onClick: advance, disabled: locked }}>
        <p>{scenario?.description}</p>
        <p>Tiền mặt <strong>{money(state.portfolio.cash)}</strong></p>
        {scenario && <dl>{Object.entries(scenario.tendencies).map(([asset, trend]) =>
          <div key={asset}><dt>{ASSETS[asset as keyof typeof ASSETS].label}</dt><dd>{trend}</dd></div>)}</dl>}
      </GamifiedModal>
    }
    case 'event':
      return <GamifiedModal badgeText={lap} title={localizeNarrative(state.event?.title ?? 'Sự kiện')}>
        {state.event?.description && <p>{localizeNarrative(state.event.description)}</p>}
        {state.eventId === 'business' && state.business.owned && <p>Vốn {money(state.business.capital)} · Dòng tiền START {money(state.business.currentStartIncome)} · Giá bán {money(state.business.currentSaleValue)}</p>}
        <Transactions key={session.stateVersion} choices={tradingChoices(detail)} {...transactionProps} />
        {state.options.map(option => <button key={option.id} data-option-id={option.id} type="button" className="button secondary" disabled={locked}
          onClick={() => send({ type: 'choose', id: option.id })}><strong>{localizeNarrative(option.label)}</strong><br /><span>{localizeNarrative(option.detail)}</span></button>)}
      </GamifiedModal>
    case 'funding':
      return <GamifiedModal badgeText={lap} title="Huy động tiền">
        <p>{localizeNarrative(state.pendingPayment?.title ?? '')} · Còn thiếu {money(state.pendingPayment?.remaining ?? 0)}</p>
        <Transactions key={session.stateVersion} choices={fundingChoices(detail)} {...transactionProps} />
      </GamifiedModal>
    case 'summary':
      return <GamifiedModal badgeText={lap} title={'Khép lại vòng ' + state.lap}
        primaryAction={{ label: 'Ghé ví tại ô Xuất phát', onClick: advance, disabled: locked }}>
        {coach}
        <dl>{state.start.summary?.lines.map((line, index) => <div key={index}><dt>{line.label}</dt><dd>{signedMoney(line.amount)}</dd></div>)}</dl>
      </GamifiedModal>
    case 'rebalancing':
      return <GamifiedModal badgeText={lap} title="Điều chỉnh danh mục"
        primaryAction={{ label: state.start.finalCheckpoint ? 'Chốt kết quả' : 'Kết thúc điều chỉnh', onClick: advance, disabled: locked }}>
        <p>Tiền mặt {money(state.portfolio.cash)} · Nợ {money(state.portfolio.debt)}</p>
        <Transactions key={session.stateVersion} choices={tradingChoices(detail)} {...transactionProps} />
      </GamifiedModal>
    case 'finished':
      return <GamifiedModal badgeText={lap} title={result?.outcome === 'victory' ? 'Hoàn thành hành trình' : result?.outcome === 'insolvent' ? 'Mất khả năng thanh toán' : 'Kết thúc hành trình'}
        primaryAction={{ label: 'Chơi ván mới', onClick: onNew }} secondaryAction={{ label: 'Về danh sách ván', onClick: onHome }}>
        {coach}
        {result && <p>Kết quả chính thức · Nguồn huy động hợp lệ <strong>{money(Number(result.lawfulProceedsVnd))}</strong></p>}
      </GamifiedModal>
    default: return null
  }
}
