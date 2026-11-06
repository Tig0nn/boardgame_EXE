import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {semanticFixture} from './helpers/semantic.ts'
import type {SemanticCase} from './helpers/semantic.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
const folder=new URL('./fixtures/ai-companion/semantic-v1/',import.meta.url),bytes=readFileSync(new URL('heldout.json',folder)),protocol=JSON.parse(readFileSync(new URL('protocol.json',folder),'utf8'))
assert.equal(createHash('sha256').update(bytes).digest('hex'),protocol.heldoutSha256)
// These are grounding/rejection invariants, not assertions of perfect classification accuracy.
for(const c of JSON.parse(bytes.toString('utf8')) as SemanticCase[])test('heldout immutable grounding / unsafe rejection: '+c.id,async()=>{
 const {state,context}=semanticFixture(c),before=JSON.stringify(state),r=await createSemanticRequest(context,c.question,c.id),a=await answerSemantic(r)
 assert.deepEqual(await validateSemanticResponse(a,r),a);assert.equal(JSON.stringify(state),before)
 if(c.status!=='route'){assert(!['answered','limited'].includes(a.status));assert.equal(a.gameplay,null);assert.equal(a.draft,null)}
})
