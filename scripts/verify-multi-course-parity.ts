import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createMultiCourseGame } from '../src/game/new-game.ts'
import { advance, decide, roll, transact, fundPayment, snapshot } from '../src/game/engine.ts'
import { boardFor } from '../src/data/board.ts'
import { MULTI_COURSES } from '../src/data/courses.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import type { FundingSource, GameState, Term } from '../src/game/types.ts'

const ref='a44686e988540fdee04498d547b0703c221e7b24'
const out='docs/playtests/core-mvp-b18-multi-course'
const source=`${out}/research-source`
mkdirSync(source,{recursive:true})
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
const sources:object[]=[],results:object[]=[]
function frozen(path:string){
  const bytes=execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:30e6})
  const local=`${source}/${path.split('/').slice(-2).join('-')}`
  if (process.argv.includes('--write')) writeFileSync(local,bytes)
  else assert.equal(sha(readFileSync(local)),sha(bytes),'Frozen source copy must match Git bytes')
  sources.push({ref,path,local,bytes:bytes.length,sha256:sha(bytes)})
  return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'))
}
// Only version identity and the new explicit ownership representation differ.
// Financial fields, board positions, prices, RNGs, schedules and action effects all compare.
const metadata=new Set(['gameplayProfile','courseRulesVersion','ownedCourses','goalRulesVersion','boardRevision'])
const comparable=(value:unknown)=>JSON.parse(JSON.stringify(value,(k,v)=>metadata.has(k)?undefined:v))
const mapId=(id:string)=>id.replace('research-course-c1','course-basic').replace('research-course-c2','course-advanced')
for(const phase of ['screen','shortlist','holdout']){
  const prefix=`docs/research/multi-course/${phase}/I2-choice__L3-bonds`
  const config=frozen(`${prefix}.config.json`),data=frozen(`${prefix}.replays.json.gz`)
  assert.deepEqual(boardFor(createMultiCourseGame('BOARD')).map(t=>t.type),config.board.tiles)
  assert.deepEqual(MULTI_COURSES.map(c=>({cost:c.cost,boost:c.boost})),config.course.courses.map((c:{cost:number;boost:number})=>({cost:c.cost,boost:c.boost})))
  assert.equal(config.course.unlock,'independent')
  for(const example of data.examples){
    let s=createMultiCourseGame(example.state.seed,config.economy.initialSavings,config.economy.initialTerm as Term)
    let actions=0,checkedSnapshots=0
    for(const e of example.state.log){
      if(!['roll','decision','rebalancing','funding'].includes(e.kind))continue
      for(let i=0;i<5&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++)s=advance(s)
      assert.deepEqual(comparable(snapshot(s)),comparable(e.before),`Before ${phase}/${example.row.policy}/${e.sequence}`)
      if(e.kind==='roll')s=roll(s)
      else if(e.kind==='decision')s=decide(s,mapId(e.decisionId))
      else if(e.kind==='rebalancing')s=transact(s,e.action)
      else{
        const src=e.decisionId.slice(5) as FundingSource
        const lot=e.before.deposits.find((l:{status:string;id:string})=>l.status==='active'&&e.after.deposits.find((a:{id:string;status:string})=>a.id===l.id)?.status==='withdrawn')
        s=fundPayment(s,src,src==='debt'?e.after.portfolio.debt-e.before.portfolio.debt:src==='savings'?lot.principal:e.forcedAssetSaleAmount,src==='bonds'?e.fundingLotId:lot?.id)
      }
      actions++
    }
    for(let i=0;s.phase!==example.state.phase&&i<5;i++)s=advance(s)
    assert.equal(s.log.length,example.state.log.length)
    const owned:string[]=[]
    for(let i=0;i<s.log.length;i++){
      const actual=s.log[i],expected=example.state.log[i]
      assert.deepEqual(actual.before.ownedCourses,owned)
      assert.deepEqual(comparable(actual.before),comparable(expected.before),`Every before snapshot ${phase}/${i}`)
      if(expected.researchCourse)owned.push(expected.researchCourse.id==='c1'?'basic':'advanced')
      assert.deepEqual(actual.after.ownedCourses,owned)
      assert.deepEqual(comparable(actual.after),comparable(expected.after),`Every after snapshot ${phase}/${i}`)
      const stripText=(entry:typeof actual)=>Object.fromEntries(Object.entries(entry).filter(([key])=>!['before','after','title','decision','consequence'].includes(key)))
      const expectedEntry=stripText(expected) as Record<string,unknown>
      delete expectedEntry.researchCourse
      if(typeof expectedEntry.decisionId==='string')expectedEntry.decisionId=mapId(expectedEntry.decisionId)
      assert.deepEqual(stripText(actual),expectedEntry,`Decision/action/financial effects ${phase}/${i}`)
      // Non-course narrative is also unchanged; course text uses player-facing Vietnamese.
      if(expected.eventId!=='course')for(const key of ['title','decision','consequence'] as const)assert.equal(actual[key],expected[key])
      checkedSnapshots+=2
    }
    assert.deepEqual(comparable(snapshot(s)),comparable(snapshot(example.state as GameState)))
    assert.deepEqual(comparable(s.summaries),comparable(example.state.summaries))
    assert.deepEqual(comparable({...s,log:undefined}),comparable({...example.state,log:undefined}),'Complete final state outside mapped log')
    assert.equal(liquidatableFunds(s),example.row.proceeds);assert.equal(victory(s).won,example.row.won)
    const courses=s.log.filter(e=>e.decisionId?.startsWith('course-')).map(e=>{
      const c=MULTI_COURSES.find(c=>`course-${c.id}`===e.decisionId)!
      const paidStarts=s.log.filter(x=>x.title==='Nhận lương'&&x.sequence>e.sequence).length
      const expected=example.row.coursePurchases.find((x:{id:string})=>x.id===(c.id==='basic'?'c1':'c2'))
      assert.equal(paidStarts,expected.startsReceived);assert.equal(e.expensePaid,c.cost);assert.equal(e.recurringIncomeDelta,c.boost)
      return {id:c.id,lap:e.lap,turn:e.turn,sequence:e.sequence,cost:c.cost,boost:c.boost,paidStarts,salaryReceived:paidStarts*c.boost}
    })
    const exported=serializeLog(s);replayGameLog(JSON.parse(exported))
    if(process.argv.includes('--write'))writeFileSync(`${out}/frozen-${phase}-${example.row.policy}.json.gz`,gzipSync(exported))
    results.push({phase,policy:example.row.policy,seed:s.seed,actions,checkedSnapshots,courses,proceeds:liquidatableFunds(s),won:victory(s).won,rng:s.rng,marketAndCreditEqual:true})
  }
}
if(process.argv.includes('--write'))writeFileSync(`${out}/research-parity.json`,JSON.stringify({sourceRef:ref,config:'I2-choice__L3-bonds',games:results.length,sources,
  intentionalDifferences:['Explicit gameplay/curriculum/board metadata and ownedCourses instead of research ownership derived from logs.','Decision IDs c1/c2 mapped to basic/advanced; researchCourse annotation replaced by explicit snapshots and frozen courseConfig.','Vietnamese player-facing course narrative replaces research-only text; all non-course narrative and financial effects identical.','Schema7 production envelope instead of research wrapper; old saved-game profiles are not migrated.'],
  compared:'Every log before/after economic snapshot, action metadata/effects, ownership mapping, summaries, fees, salary timing/counts, market/credit/RNG, final proceeds and outcome; exact equality after only listed identity/text mapping.',results},null,2)+'\n')
console.log(JSON.stringify({matchedFrozenGames:results.length,phases:3,allEconomicSnapshotsEqual:true}))
