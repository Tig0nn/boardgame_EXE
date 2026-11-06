import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createQuestionFeature} from '../src/ai/companion/question-feature.ts'
import {createDraftStore} from '../mobile_app/src/game/draft-store.ts'
import {createSemanticBinding,semanticAiOptIn} from '../mobile_app/src/game/semantic-ai.ts'
import {answerSemantic} from '../src/ai/companion/semantic-index.ts'
import {encounter} from './helpers/universal.ts'
import {normalizeDraftInput} from '../src/ai/companion/draft-index.ts'
for(const event of ['question','amount','option','snapshot','disable','unmount'] as const)test('semantic pending '+event+' cannot render stale result',async()=>{
 let s=encounter('gold');const listeners=new Set<()=>void>(),session={getSnapshot:()=>s,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}},feature=createQuestionFeature(true),store=createDraftStore();let entered!:()=>void,release!:(v:unknown)=>void,raw:unknown
 const ready=new Promise<void>(r=>{entered=r}),b=createSemanticBinding(session,feature,store,()=>{},async r=>{raw=await answerSemantic(r);entered();return new Promise(r=>{release=r})}),stop=b.subscribe(()=>{})
 const input=normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount:2000000});store.publish('owner',s,input);const pending=b.ask('Mua vàng này thì ví tôi còn nhiêu?');await ready
 if(event==='question')b.cancel();if(event==='amount')store.publish('owner',s,{...input,amount:1000000});if(event==='option')store.publish('owner',s,{...input,operation:'sell'});if(event==='snapshot'){s={...s,portfolio:{...s.portfolio,cash:s.portfolio.cash-1}};listeners.forEach(fn=>fn())};if(event==='disable')feature.setEnabled(false);if(event==='unmount')stop()
 release(raw);assert.equal(await pending,null);assert.equal(b.getSnapshot().response,null);stop()
})
test('Semantic cold/disabled and production opt-in do no work',async()=>{
 const s=encounter('gold'),session={getSnapshot:()=>s,subscribe:()=>()=>{}},f=createQuestionFeature(false);let calls=0;const b=createSemanticBinding(session,f,null,()=>{},async()=>{calls++;throw Error('no')});assert.equal(await b.ask('Ví còn bao nhiêu?'),null);const stop=b.subscribe(()=>{});assert.equal(await b.ask('Ví còn bao nhiêu?'),null);assert.equal(calls,0);stop()
 for(const dev of [false,true])for(const q of ['','?semanticAi=1','?universalAi=1&semanticAi=1'])assert.equal(semanticAiOptIn(dev,q),dev&&q.includes('universalAi=1'))
})
