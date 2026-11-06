import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {encounter} from './helpers/universal.ts'
import {normalizeDraftInput,projectDraftContext,createDraftRequest,answerDraft} from '../src/ai/companion/draft-index.ts'
const cases=JSON.parse(readFileSync(new URL('./fixtures/ai-companion/draft-evaluation-v1.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')) as {id:string;question:string;input:string;status:string;reason:string}[]
for(const c of cases)test('draft labeled evaluation: '+c.id,async()=>{
 const game=encounter('gold'),amount=c.input==='blank'?null:c.input==='negative'?-1:c.input==='too-high'?Number.MAX_SAFE_INTEGER:1_000_000
 const context=projectDraftContext(game,{sessionEpoch:'evaluation',revision:1,draftId:'gold-form',draftRevision:1},c.input==='missing'?null:normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount})),r=await answerDraft(await createDraftRequest(context,c.question,'evaluation-'+c.id))
 assert.equal(r.status,c.status);assert.equal(r.reason,c.reason)
 if(r.status==='answered'){assert.equal(r.lines.find(l=>l.code==='payNow')!.value,1_000_000);assert.match(r.explanation,/chưa thực hiện/)}else{assert.deepEqual(r.lines,[]);assert.match(r.conclusion,/Chưa giải đáp/)}
})
