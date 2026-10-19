import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ASSETS } from '../data/config'
import { saleQuote } from '../game/selectors'
import { creditBondLots } from '../game/bond-credit'
import { money } from '../game/format'
import type { GameState, RebalanceAction, TradableAsset } from '../game/types'
import { MoneyInput } from './MoneyInput'
import { FinancialTerm } from './FinancialTerm'

export function InvestmentEncounter({game,buyPanel,onTransaction,onSkip}:{game:GameState;buyPanel:ReactNode;onTransaction:(a:RebalanceAction)=>boolean|void;onSkip:()=>void}){
  const asset=game.eventId as TradableAsset,lots=asset==='bonds'?creditBondLots(game).filter(x=>x.quote.executable):[]
  const [mode,setMode]=useState<'buy'|'sell'>('buy'),[lotId,setLotId]=useState(lots[0]?.lot.id??'')
  const [symbolId,setSymbolId]=useState(game.market.stocks.find(s=>(game.stockHoldings[s.id]?.units??0)>0)?.id??game.market.stocks[0].id)
  const stock=game.market.stocks.find(s=>s.id===symbolId)!,lot=lots.find(x=>x.lot.id===lotId)??lots[0]
  const available=asset==='bonds'?lot?.quote.gross??0:asset==='stocks'?Math.min(game.portfolio.stocks,Math.round(stock.currentPrice*(game.stockHoldings[symbolId]?.units??0))):game.portfolio.gold
  const [amount,setAmount]=useState(available),lock=useRef(false)
  const valid=Number.isSafeInteger(amount)&&amount>0&&amount<=available
  const quote=saleQuote(game,asset,valid?amount:0,asset==='bonds'?lot?.lot.id:undefined)
  const sell=()=>{if(lock.current||!valid)return;lock.current=true;try{if(onTransaction({kind:'sell',asset,amount,symbolId:asset==='stocks'?symbolId:undefined,lotId:asset==='bonds'?lot?.lot.id:undefined})===false)lock.current=false}catch(e){lock.current=false;throw e}}
  return <section className="investment-encounter">
    <div className="investment-actions" aria-label="Hành động đầu tư"><button className="button secondary" aria-pressed={mode==='buy'} onClick={()=>setMode('buy')}>Mua</button><button className="button secondary" aria-pressed={mode==='sell'} onClick={()=>{setMode('sell');setAmount(available)}}>Bán</button></div>
    <p className="inline-note">Một giao dịch thành công mỗi lần ghé. Giao dịch lỗi không mất lượt; giá chỉ đổi tại START hoặc Sự kiện.</p>
    {mode==='buy'?buyPanel:<>
      <h3>Bán {ASSETS[asset].label.toLowerCase()}</h3>
      {asset==='stocks'&&<><label htmlFor="tile-sell-stock">Mã đang giữ</label><select id="tile-sell-stock" value={symbolId} onChange={e=>{const id=e.target.value;setSymbolId(id);const stock=game.market.stocks.find(x=>x.id===id)!;setAmount(Math.min(game.portfolio.stocks,Math.round(stock.currentPrice*(game.stockHoldings[id]?.units??0))))}}>{game.market.stocks.filter(x=>(game.stockHoldings[x.id]?.units??0)>0).map(x=><option key={x.id} value={x.id}>{x.id} · {x.name}</option>)}</select></>}
      {asset==='bonds'&&<><label htmlFor="tile-sell-bond">Khoản có giá bán hợp lệ</label><select id="tile-sell-bond" value={lot?.lot.id??''} onChange={e=>{setLotId(e.target.value);setAmount(lots.find(x=>x.lot.id===e.target.value)!.quote.gross)}}>{lots.map(x=><option key={x.lot.id} value={x.lot.id}>{x.lot.id} · Nhận tối đa {money(x.quote.net)}</option>)}</select></>}
      {available<=0?<p role="status">Chưa có tài sản này với giá bán hợp lệ. Bạn có thể mua hoặc bỏ qua.</p>:<>
        <label htmlFor="tile-sell-amount">Giá trị muốn bán · Tối đa {money(available)}</label><MoneyInput id="tile-sell-amount" amount={amount} onChange={setAmount} invalid={!valid}/>
        {!valid&&<p className="input-error">Nhập số tiền nguyên dương trong giá trị tài sản đang giữ.</p>}
        <div className="decision-preview"><span>Giá trị bán<strong>{money(quote.gross)}</strong></span><span>Phí<strong>{money(quote.fee)}</strong></span><span><FinancialTerm term="spread" /><strong>{money(quote.spread)}</strong></span><span>Thực nhận vào tiền mặt<strong>{money(quote.net)}</strong></span><span>Tiền mặt sau bán<strong>{money(game.portfolio.cash+quote.net)}</strong></span></div>
        <button className="button primary full-button" disabled={!valid} onClick={sell}>Xác nhận bán · Nhận {money(quote.net)}</button>
      </>}
      <button className="button secondary full-button" onClick={onSkip}>Bỏ qua cơ hội</button>
    </>}
  </section>
}
