import {advance,decide,roll} from '../../../src/game/engine.ts'
import {createCoreMvpGame} from '../../../src/game/new-game.ts'
import {boardFor} from '../../../src/data/board.ts'
import {fundingSources} from '../../../src/game/transactions.ts'
import {hashSeed,random} from '../../../src/game/random.ts'
import {allocationStep} from '../risk-allocation/policy.mjs'
import {choiceSet} from '../core-mvp/policy.mjs'
import {holdings} from '../trading-ab/policy.mjs'
import {availableCourses,buyCourse,purchases} from './courses.mjs'
import {metrics,audit} from './metrics.mjs'
export function chooseCourse(s,p,c){
  if(p.course==='none')return null
  const reserve=p.course==='roi'?p.reserve:0
  const options=availableCourses(s,c).filter(x=>s.portfolio.cash-x.cost>=reserve)
  if(!options.length)return null
  if(p.course==='synthetic'){
    const u=random(hashSeed(`COURSE-INTENT:${s.seed}:${s.turn}:${s.lap}`))[0]
    return [null,...options][Math.floor(u*(options.length+1))]
  }
  if(p.course==='early')return options.toSorted((a,b)=>a.cost-b.cost||b.boost-a.boost)[0]
  if(p.course==='all')return options[0]
  const remaining=s.totalLaps-s.lap+1
  return options.filter(x=>x.boost*remaining>=x.cost).toSorted((a,b)=>(b.boost*remaining-b.cost)-(a.boost*remaining-a.cost)||a.cost-b.cost)[0]??null
}
export function step(s,p,c){
  if(s.phase==='rolling')return roll(s)
  if(s.phase==='event'&&boardFor(s)[s.position].type==='course'){
    const course=chooseCourse(s,p,c)
    return course?buyCourse(s,c,course.id):decide(s,'skip')
  }
  const scoped={...c,policy:{...c.policy,reserve:p.reserve,liquidityReserve:p.reserve}}
  return allocationStep(s,p.allocation,scoped)
}
export function play(seed,p,c,{trace=false}={}){
  let s=createCoreMvpGame(seed,0,3),courseVisits=0,courseAvailable=0,courseAffordable=0,courseReserveAffordable=0,courseExhausted=0,courseProfitable=0,decisions=0
  const visitsByTile=Array(18).fill(0),courseVisitDetail=[]
  for(let n=0;s.phase!=='finished'&&n<800;n++){
    if(s.phase==='event'){
      const t=boardFor(s)[s.position].type;visitsByTile[s.position]++
      if(t==='course'){
        const options=availableCourses(s,c),affordable=options.filter(x=>x.cost<=s.portfolio.cash),profitable=affordable.filter(x=>x.boost*(s.totalLaps-s.lap+1)>x.cost)
        const reserveAffordable=options.filter(x=>x.cost+p.reserve<=s.portfolio.cash)
        courseVisits++;courseAvailable+=Number(options.length>0);courseAffordable+=Number(affordable.length>0)
        courseReserveAffordable+=Number(reserveAffordable.length>0);courseExhausted+=Number(purchases(s,c).length===c.course.courses.length);courseProfitable+=Number(profitable.length>0)
        decisions+=Number(affordable.length>0)
        courseVisitDetail.push({tile:s.position,lap:s.lap,turn:s.turn,remaining:options.length,affordable:affordable.length,profitable:profitable.length,distinctOptions:new Set(affordable.map(x=>`${x.cost}/${x.boost}`)).size})
      }else{
        const options=choiceSet(s,c).length+(['stocks','bonds','gold'].includes(t)?holdings(s,t).length:0)
        decisions+=Number(options>1)
      }
    }else if(s.phase==='funding')decisions+=Number(fundingSources(s).length>1)
    const before=s;s=step(s,p,c)
    if(s===before)throw Error(`Stalled ${seed}/${p.id}/${c.id}`)
  }
  if(s.phase!=='finished')throw Error('Study deadlock')
  audit(s,c)
  const row={...metrics(s,c),seed,config:c.id,system:c.course.id,layout:c.board.id,policy:p.id,allocation:p.allocation,coursePolicy:p.course,reserve:p.reserve,
    courseVisits,courseAvailable,courseAffordable,courseReserveAffordable,courseExhausted,courseProfitable,decisions,visitsByTile,courseVisitDetail}
  return trace?{row,state:s}:row
}
