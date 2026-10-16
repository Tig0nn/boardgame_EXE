import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {play,chooseCourse,step} from './policy.mjs'
import {createCoreMvpGame} from '../../../src/game/new-game.ts'
import {config,policies,layouts} from './spec.mjs'
import {replay} from './replay.mjs'
import {serializeLog} from '../../../src/game/log.ts'
const root=process.argv[2],c=JSON.parse(readFileSync(new URL('../../../config.json',import.meta.url)))
const originalReplay=await import(pathToFileURL(join(root,'scripts/diagnostics/replay-game-log.ts')))
let n=0
for(const id of ['cash-roi','savings-roi','diversified-roi','novice'])for(let i=0;i<3;i++){
  const p=policies.find(x=>x.id===id),result=play(`B18-COURSE-VERIFY-${i}`,p,c,{trace:true})
  replay(result.state,c)
  assert.deepEqual(play(result.row.seed,p,c),result.row)
  if(c.course.id==='A-baseline'&&c.board.id==='L4-original'){
    const data=JSON.parse(serializeLog(result.state)),actual=originalReplay.replayGameLog(data)
    assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(actual)),data.state),'Baseline full production state parity, JSON normalization only')
  }
  n++
}
assert.equal(c.board.tiles.length,18);assert.equal(new Set(c.board.tiles).size,9)
const choice=config('I2-choice','L4-original'),initial=createCoreMvpGame('RESERVE-CONTROL',0),s={...initial,phase:'event',eventId:'course',position:4,portfolio:{...initial.portfolio,cash:14e6}},base=policies.find(p=>p.id==='savings-roi')
assert.equal(chooseCourse(s,base,choice),null)
assert.equal(chooseCourse(s,policies.find(p=>p.id==='savings-course-reserve0'),choice).id,'c2')
assert.equal(chooseCourse(s,policies.find(p=>p.id==='savings-course-reserve5'),choice).id,'c1')
assert.equal(chooseCourse(s,policies.find(p=>p.id==='savings-course-reserve15'),choice),null)
const bank={...initial,phase:'event',eventId:'bank',position:6,portfolio:{...initial.portfolio,cash:20e6}}
assert.ok(isDeepStrictEqual(step(bank,base,choice),step(bank,policies.find(p=>p.id==='savings-course-reserve0'),choice)),'Learning reserve experiment must leave bank behavior fixed')
console.log(JSON.stringify({config:c.id,replayed:n,baselineProductionParity:c.course.id==='A-baseline'&&c.board.id==='L4-original',layouts:layouts.length,knownConfig:config(c.course.id,c.board.id).id}))
