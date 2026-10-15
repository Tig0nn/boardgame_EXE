import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { saleQuote } from '../../../src/game/selectors.ts'
import { boardFor } from '../../../src/data/board.ts'

const ASSETS=['stocks','bonds','gold']
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
export function auditTrading(s,arm){
  const visits=new Set(),board=boardFor(s)
  for(const e of s.log){const a=e.action
    if(!a||!ASSETS.includes(a.asset)||!['buy','sell'].includes(a.kind)||e.before.phase!=='event')continue
    assert.equal(board[e.tileId].type,a.asset,'Financial trade at wrong tile')
    assert.ok(!visits.has(e.turn),'More than one successful trade in a visit');visits.add(e.turn)
    if(a.kind==='sell')assert.equal(arm,'new','Old arm sold at tile')
    assert.equal(e.after.phase,'rolling','Financial trade must close the encounter')
  }
}
const sumBasis=(snap,asset)=>asset==='stocks'?Object.values(snap.stockHoldings).reduce((n,h)=>n+h.costBasis,0):asset==='gold'?snap.goldCostBasis:snap.bondLots.reduce((n,l)=>n+(l.credit?.costBasis??0),0)
export function tradingMetrics(s,c){
  const assets=Object.fromEntries(ASSETS.map(a=>[a,{buys:0,sells:0,tileSells:0,startSells:0,forcedSells:0,bought:0,soldGross:0,soldNet:0,fees:0,spread:0,realizedCapitalPnl:0}]))
  const reasons={};let feesPaid=0,spreadPaid=0,buys=0,sells=0,tileSells=0,startSells=0,forcedSells=0,realizedGain=0,realizedLoss=0
  for(const e of s.log){const a=e.action,forced=e.kind==='funding'&&e.forcedAssetSaleAmount>0,asset=forced?e.decisionId.slice(5):a?.asset
    if(!ASSETS.includes(asset))continue
    if(a?.kind==='buy'){assets[asset].buys++;assets[asset].bought+=a.amount;buys++;continue}
    if(!forced&&a?.kind!=='sell')continue
    const amount=forced?e.forcedAssetSaleAmount:a.amount,lotId=forced?e.fundingLotId:a.lotId,q=saleQuote(e.before,asset,amount,lotId)
    assert.equal(q.net,e.cashProceeds,'Sale cash/quote mismatch')
    const basis=sumBasis(e.before,asset)-sumBasis(e.after,asset),pnl=q.net-basis
    const reason=forced?'funding':a.researchReason??'start-liquidity',r=reasons[reason]??{count:0,gain:0,loss:0,netCapitalPnl:0}
    r.count++;r.gain+=Math.max(0,pnl);r.loss+=Math.max(0,-pnl);r.netCapitalPnl+=pnl;reasons[reason]=r
    const m=assets[asset];m.sells++;m.soldGross+=amount;m.soldNet+=q.net;m.fees+=q.fee;m.spread+=q.spread;m.realizedCapitalPnl+=pnl
    sells++;feesPaid+=q.fee;spreadPaid+=q.spread;realizedGain+=Math.max(0,pnl);realizedLoss+=Math.max(0,-pnl)
    if(forced){forcedSells++;m.forcedSells++}else if(e.before.phase==='event'){tileSells++;m.tileSells++}else{startSells++;m.startSells++}
  }
  const rollCash=s.log.filter(e=>e.kind==='roll').map(e=>e.before.portfolio.cash)
  return {buys,sells,successfulFinancialTrades:buys+sells,tileSells,startSells,forcedSells,feesPaid,spreadPaid,transactionCosts:feesPaid+spreadPaid,realizedGain,realizedLoss,netRealizedCapitalPnl:realizedGain-realizedLoss,
    cashDuringRollMean:rollCash.reduce((a,b)=>a+b,0)/rollCash.length,reserveBreachRollRate:rollCash.filter(x=>x<c.policy.reserve).length/rollCash.length,
    assets,reasons,marketHash:digest(s.market),creditMarketHash:digest(s.bondCredit)}
}
