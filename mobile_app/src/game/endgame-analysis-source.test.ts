import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {prepareAnalysisSource,listGoldDecisions} from './endgame-analysis-source.ts'
import {WorkBudget} from './endgame-whatif-contract.ts'
const text=()=>gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')
test('full exact historical text verifies and lists only native-legal Gold C1 buy4',async()=>{
 const s=await prepareAnalysisSource({kind:'text',text:text()},new WorkBudget())
 assert.equal(s.identity.sourceHash,'7b4b8e94646da6f1a31ee2dfa540aa12dc53eb6755737a6512193969db3bf2ac')
 const catalog=await listGoldDecisions(s,new WorkBudget());assert.deepEqual(catalog.map(x=>x.decision.sequence),[4]);assert.equal(s.identity.entries,93)
})
test('START4 summary and rebalancing are not terminal history',async()=>{
 for(const phase of ['summary','rebalancing']){const d=JSON.parse(text());d.state.phase=phase;d.state.termination=null;await assert.rejects(prepareAnalysisSource({kind:'text',text:JSON.stringify(d)},new WorkBudget()))}
})

import {replayHistory} from './endgame-whatif-replay.ts'
import {parseHistory,digest} from './endgame-whatif-identity.ts'
test('private native snapshot recapture has its own exact hash and equal verified full semantics',async()=>{
 const native=await replayHistory(parseHistory(text()),new WorkBudget()),s=await prepareAnalysisSource({kind:'snapshot',snapshot:native.final},new WorkBudget()),t=await prepareAnalysisSource({kind:'text',text:text()},new WorkBudget())
 assert.equal(s.identity.sourceHash,await digest(s.text));assert.equal(t.identity.sourceHash,await digest(text()));assert.equal(s.identity.semanticHash,t.identity.semanticHash);assert.equal(s.identity.origin,'snapshot');assert.equal(native.final.phase,'finished')
})
for(const type of ['schema','profile','config','incomplete','snapshot'] as const)test('full source refuses '+type,async()=>{
 const d=JSON.parse(text());if(type==='schema')d.schemaVersion=6;if(type==='profile')d.state.gameplayProfile='foreign';if(type==='config')d.financialConfig.ECONOMY.goldSpread=0.9;if(type==='incomplete')d.entries.splice(5,1);if(type==='snapshot')d.entries[3].before.portfolio.cash++
 await assert.rejects(prepareAnalysisSource({kind:'text',text:JSON.stringify(d)},new WorkBudget()))
})
test('source data graph, getters, size, cancellation and async mutation fail closed',async()=>{
 let called=0;const getter=Object.defineProperty({kind:'text'},'text',{enumerable:true,get(){called++;return text()}})
 await assert.rejects(prepareAnalysisSource(getter as never,new WorkBudget()));assert.equal(called,0)
 const cycle:{kind:string;self?:unknown}={kind:'text'};cycle.self=cycle;await assert.rejects(prepareAnalysisSource(cycle as never,new WorkBudget()))
 await assert.rejects(prepareAnalysisSource({kind:'text',text:'x'.repeat(20_000_001)},new WorkBudget()))
 await assert.rejects(prepareAnalysisSource({kind:'text',text:'ệ'.repeat(8_000_000)},new WorkBudget()),/transport-source-wire-cap/)
 const ac=new AbortController();ac.abort();await assert.rejects(prepareAnalysisSource({kind:'text',text:text()},new WorkBudget({signal:ac.signal})),/cancelled/)
 const input={kind:'text' as const,text:text()},run=prepareAnalysisSource(input,new WorkBudget());input.text='mutated';await assert.rejects(run,/source-input-mutated/)
})