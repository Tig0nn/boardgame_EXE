import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {createCoreMvpGame} from '../../../src/game/new-game.ts'
import {advance,roll,decide,transact,fundPayment,snapshot} from '../../../src/game/engine.ts'
import {buyCourse} from './courses.mjs'
export function replay(state,c){
  const equal=(a,b,label)=>assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b))),label)
  let s=createCoreMvpGame(state.seed,0,3)
  for(const e of state.log){
    if(!['roll','decision','funding','rebalancing'].includes(e.kind))continue
    for(let i=0;i<6&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++)s=advance(s)
    equal(snapshot(s),e.before,`Before action${e.sequence}`)
    if(e.researchCourse)s=buyCourse(s,c,e.researchCourse.id)
    else if(e.kind==='roll')s=roll(s)
    else if(e.kind==='decision')s=decide(s,e.decisionId)
    else if(e.kind==='rebalancing')s=transact(s,e.action)
    else{
      const source=e.decisionId.slice(5),lot=e.before.deposits.find(l=>l.status==='active'&&e.after.deposits.find(a=>a.id===l.id)?.status==='withdrawn')
      s=fundPayment(s,source,source==='savings'?lot.principal:source==='debt'?e.after.portfolio.debt-e.before.portfolio.debt:e.forcedAssetSaleAmount,source==='bonds'?e.fundingLotId:lot?.id)
    }
  }
  for(let i=0;i<6&&(s.phase!==state.phase||s.lap!==state.lap);i++)s=advance(s)
  equal(s,state,'Complete research replay')
  return s
}
