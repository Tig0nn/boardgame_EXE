import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createGameplayBinding,universalAiOptIn} from '../mobile_app/src/game/universal-ai.ts'
import {createQuestionFeature} from '../src/ai/companion/question-feature.ts'
import {answerGameplay} from '../src/ai/companion/universal-index.ts'
import {encounter} from './helpers/universal.ts'
import type {GameState} from '../src/game/types.ts'
import type {GameplayRequest} from '../src/ai/companion/universal-index.ts'
async function until(fn:()=>boolean){for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,5));assert.ok(fn())}
function setup(enabled=true,work?:Parameters<typeof createGameplayBinding>[2]) {
 let s=encounter('gold');const listeners=new Set<()=>void>(),feature=createQuestionFeature(enabled)
 const session={getSnapshot:()=>s,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}}
 const binding=createGameplayBinding(session,feature,work),stop=binding.subscribe(()=>{})
 return {binding,feature,stop,listeners,change(next:GameState={...s,portfolio:{...s.portfolio,cash:s.portfolio.cash-1}}){s=next;listeners.forEach(fn=>fn())}}
}
test('DEV opt-in only; OFF blocks injected transport completely',async()=>{
 assert.equal(universalAiOptIn(false,'?universalAi=1'),false);assert.equal(universalAiOptIn(true,''),false);assert.equal(universalAiOptIn(true,'?universalAi=1'),true)
 let calls=0;const h=setup(false,async()=>{calls++;throw Error('must not run')});h.binding.edit('Vàng trong game hoạt động thế nào?');assert.equal(await h.binding.ask(),null);assert.equal(calls,0);h.stop()
})
test('exact question, context digest and request identity; delivery guarded and frozen',async()=>{
 let request:GameplayRequest|undefined;const h=setup(true,async(r)=>{request=r;return answerGameplay(r)})
 const raw='  Vàng trong game hoạt động thế nào?  ';h.binding.edit(raw);const a=await h.binding.ask();assert.equal(a?.status,'answered');assert.equal(request!.question,raw);assert.equal(h.binding.getSnapshot().isCurrent(),true);assert.ok(Object.isFrozen(a));h.change();assert.equal(h.binding.getSnapshot().response,null);assert.equal(h.binding.getSnapshot().question,'');h.stop()
})
for(const event of ['edit','close','snapshot','disable','unmount'] as const)test(`${event} cancels ignored-signal work and stale response`,async()=>{
 let started=false,signal:AbortSignal|undefined,resolve:(r:unknown)=>void=()=>{};const gate=new Promise(r=>resolve=r)
 const h=setup(true,async(r,s)=>{signal=s;started=true;await gate;return answerGameplay(r)})
 h.binding.edit('Vàng trong game hoạt động thế nào?');const task=h.binding.ask();await until(()=>started)
 if(event==='edit')h.binding.edit('Vàng có rủi ro gì?')
 if(event==='close')h.binding.close()
 if(event==='snapshot')h.change()
 if(event==='disable')h.feature.setEnabled(false)
 if(event==='unmount')h.stop()
 assert.equal(await task,null);assert.equal(signal!.aborted,true);resolve(null);await new Promise(r=>setTimeout(r,10));assert.equal(h.binding.getSnapshot().response,null);if(event!=='unmount')h.stop()
})
test('new session epoch, StrictMode subscribe cycle, no automatic request',async()=>{
 let calls=0;const h=setup(true,async r=>{calls++;return answerGameplay(r)}),first=h.binding.getSnapshot().context!.sessionEpoch
 h.stop();const again=h.binding.subscribe(()=>{});assert.notEqual(h.binding.getSnapshot().context!.sessionEpoch,first);assert.equal(calls,0)
 h.binding.edit('Vàng có rủi ro gì?');await Promise.all([h.binding.ask(),h.binding.ask()]);assert.equal(calls,1);again();assert.equal(h.listeners.size,0)
})
test('synchronous abort reentrancy preserves newer edit/request',async()=>{
 let calls=0,started=false,newTask:Promise<unknown>|undefined
 const h=setup(true,async(r,signal)=>{calls++;if(calls===1){started=true;signal.addEventListener('abort',()=>{h.binding.edit('Vàng có rủi ro gì?');newTask=h.binding.ask()},{once:true});return new Promise(()=>{})}return answerGameplay(r)})
 h.binding.edit('Vàng trong game hoạt động thế nào?');const old=h.binding.ask();await until(()=>started)
 h.binding.edit('Giá vàng hiện tại là bao nhiêu?');assert.equal(await old,null);await newTask
 assert.equal(h.binding.getSnapshot().question,'Vàng có rủi ro gì?');assert.equal(h.binding.getSnapshot().status,'answered');assert.equal(calls,2);h.stop()
})
test('reentrant close prevents abort callback restarting work',async()=>{
 let started=false,calls=0;const h=setup(true,async(_r,signal)=>{calls++;started=true;signal.addEventListener('abort',()=>{h.binding.edit('Vàng có rủi ro gì?');void h.binding.ask()});return new Promise(()=>{})})
 h.binding.edit('Vàng trong game hoạt động thế nào?');const old=h.binding.ask();await until(()=>started);h.binding.close();assert.equal(await old,null);assert.equal(calls,1);assert.equal(h.binding.getSnapshot().question,'');h.stop()
})
test('listener invalidates immediately before render; old delivery cannot render',async()=>{
 const h=setup();let switched=false;const off=h.binding.subscribe(()=>{if(!switched&&h.binding.getSnapshot().response){switched=true;h.change()}})
 h.binding.edit('Vàng trong game hoạt động thế nào?');assert.equal(await h.binding.ask(),null);assert.equal(h.binding.getSnapshot().response,null);off();h.stop()
})
test('tampered claims and cross-request correlation become sanitized error',async()=>{
 const h=setup(true,async r=>({...await answerGameplay(r),requestId:'other-request',conclusion:'PRIVATE_PROVIDER_ERROR'}))
 h.binding.edit('Vàng trong game hoạt động thế nào?');await h.binding.ask();assert.equal(h.binding.getSnapshot().status,'error');assert.equal(h.binding.getSnapshot().response,null);h.stop()
})
test('review: incomplete macro evidence does not advertise an AI-capable UI context',async()=>{
 let calls=0;const h=setup(true,async r=>{calls++;return answerGameplay(r)})
 const missing=encounter('credit-tightening');missing.log=[];h.change(missing)
 assert.equal(h.binding.getSnapshot().context,null);h.binding.edit('Tin kinh tế này có nghĩa gì?');assert.equal(await h.binding.ask(),null);assert.equal(calls,0);h.stop()
})