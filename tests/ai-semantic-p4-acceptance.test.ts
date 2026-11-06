import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {acceptanceFixture} from './helpers/semantic-p4.ts'
import type {AcceptanceCase} from './helpers/semantic-p4.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
const cases=JSON.parse(readFileSync(new URL('./fixtures/ai-companion/semantic-p4/context-acceptance.json',import.meta.url),'utf8')) as AcceptanceCase[]
for(const c of cases)test('P4 question/form consistency: '+c.id,async()=>{
 const {state,context,question}=acceptanceFixture(c),before=JSON.stringify(state),r=await createSemanticRequest(context,question,c.id),a=await answerSemantic(r)
 if(c.expected==='safe-fallback'){assert(!['answered','limited'].includes(a.status),JSON.stringify(a.route));assert.equal(a.gameplay,null);assert.equal(a.draft,null);if(c.reason)assert.equal(a.route.reason,c.reason)}else{assert.equal(a.status,'answered');if(a.draft){assert.equal(a.draft.draftId,context.draft!.draftId);assert.equal(a.draft.draftRevision,context.draft!.draftRevision);assert.deepEqual(a.draft.lines,context.draft!.preview.lines)}}
 assert.equal(JSON.stringify(state),before);assert.deepEqual(await validateSemanticResponse(a,r),a)
})
