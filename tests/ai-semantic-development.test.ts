import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {encounter,phaseState} from './helpers/universal.ts'
import {classifySemantic,createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
import {projectGameplayContext} from '../src/ai/companion/universal-index.ts'
import {normalizeDraftInput,projectDraftContext} from '../src/ai/companion/draft-index.ts'
const cases=JSON.parse(readFileSync(new URL('./fixtures/ai-companion/semantic-v1/development.json',import.meta.url),'utf8'))
for(const c of cases)test('semantic development: '+c.id,async()=>{
 const s=['funding','summary','rebalancing','forecast'].includes(c.fixture)?phaseState(c.fixture):c.fixture==='overview'?phaseState('rolling'):encounter(c.fixture==='personal'?'repair':c.fixture==='macro'?'credit-tightening':c.fixture)
 const identity={sessionEpoch:'semantic-dev',revision:1,draftId:'form',draftRevision:1},actual=projectGameplayContext(s,{sessionEpoch:identity.sessionEpoch,revision:identity.revision}),draft=c.draft?projectDraftContext(s,identity,normalizeDraftInput(c.draft)):null,context={actual,draft},r=classifySemantic(c.question,context)
 assert.equal(r.status,c.status);assert.equal(r.scope,c.scope);assert.equal(r.intent,c.intent)
 const req=await createSemanticRequest(context,c.question,c.id),a=await answerSemantic(req);assert.deepEqual(await validateSemanticResponse(a,req),a)
 await assert.rejects(validateSemanticResponse({...a,notice:'Chắc chắn thắng'},req))
})
