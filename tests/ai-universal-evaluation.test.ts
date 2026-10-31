import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {encounter,phaseState} from './helpers/universal.ts'
import {projectGameplayContext,createGameplayRequest,answerGameplay} from '../src/ai/companion/universal-index.ts'
const fixture=JSON.parse(readFileSync(new URL('./fixtures/ai-companion/universal-evaluation-v1.json',import.meta.url),'utf8')) as {cases:{domain:string;question:string;status:string;category:string}[]}
for(const [i,c]of fixture.cases.entries())test(`evaluation ${i+1}: ${c.domain} / ${c.category}`,async()=>{
 const phases=['forecast','overview','funding','summary','rebalancing']
 const state=phases.includes(c.domain)?phaseState(c.domain==='overview'?'rolling':c.domain):encounter(c.domain==='personal'?'repair':c.domain==='macro'?'credit-tightening':c.domain)
 const context=projectGameplayContext(state,{sessionEpoch:'evaluation',revision:0})
 const response=await answerGameplay(await createGameplayRequest(context,c.question,'eval-request'))
 assert.equal(response.status,c.status)
 if(c.status==='fallback'){assert.deepEqual(response.facts,[]);assert.equal(response.reflection,null);assert.deepEqual(response.actions,[])}
 else {for(const fact of response.facts)assert.ok(context.facts.some(f=>JSON.stringify(f)===JSON.stringify(fact)));assert.ok(response.explanation.length>100)}
})