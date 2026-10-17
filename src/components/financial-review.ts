import type {GameState} from '../game/types.ts'
import {rulesForGame} from '../game/rules-profile.ts'
import {money} from '../game/format.ts'

// Presentation only: summarize recorded actions/payments, never explain a cause of victory.
export function financialReview(game:GameState) {
  const facts:Array<{id:string;text:string;amounts:number[]}>=[]
  const paidCourse=game.log.filter(e=>e.kind==='decision'&&e.eventId==='course').reduce((n,e)=>n+(e.expensePaid??0),0)
  const extraSalary=game.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương').reduce((n,e)=>n+Math.max(0,e.cashDelta-rulesForGame(e.before).recurringIncome),0)
  if(paidCourse>0)facts.push({id:'courses',amounts:[paidCourse,extraSalary],text:`Học phí đã trả ${money(paidCourse)} · Lương thêm đã nhận ${money(extraSalary)}.`})
  const trading=game.log.reduce((n,e)=>{
    if(!['rebalancing','funding'].includes(e.kind)||typeof e.cashProceeds!=='number')return n
    const gross=Object.values(e.assetSaleAmounts??{}).reduce((sum,a)=>sum+a,0)
    return n+(gross>0?Math.max(0,gross-e.cashProceeds):0)
  },0)
  if(trading>0)facts.push({id:'trading',amounts:[trading],text:`Phí và chênh lệch mua/bán đã trả ${money(trading)}.`})
  if(game.portfolio.debt>0)facts.push({id:'debt',amounts:[game.portfolio.debt],text:`Nợ còn lại ${money(game.portfolio.debt)}, đã trừ khỏi nguồn tiền về đích.`})
  if(game.business.capital>0)facts.push({id:'business',amounts:[game.business.capital],text:`Vốn quán chưa bán ${money(game.business.capital)}, không tính vào đích.`})
  const personal=game.log.filter(e=>['decision','funding'].includes(e.kind)&&['medical','repair','family'].includes(e.eventId??'')).reduce((n,e)=>n+(e.expensePaid??0),0)
  if(personal>0)facts.push({id:'personal',amounts:[personal],text:`Thanh toán ngay cho biến cố cá nhân ${money(personal)}.`})
  // A cash-only run still has recorded cash flows; show those rather than invent a strategy.
  if(!facts.length){
    const salary=game.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương').reduce((n,e)=>n+e.cashDelta,0)
    const living=game.log.filter(e=>e.title==='Chi phí sinh hoạt'||e.eventId==='living').reduce((n,e)=>n+(e.expensePaid??0),0)
    if(salary>0)facts.push({id:'salary',amounts:[salary],text:`Lương đã nhận ${money(salary)}.`})
    if(living>0)facts.push({id:'living',amounts:[living],text:`Sinh hoạt đã trả ${money(living)}.`})
  }
  return facts
}
