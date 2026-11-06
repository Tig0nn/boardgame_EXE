import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {QUESTION_BANK} from '../src/ai/companion/universal-index.ts'
test('sealed holdout is independent of development sentences and frozen public phrase banks',()=>{
 const folder=new URL('./fixtures/ai-companion/semantic-v1/',import.meta.url),heldout=JSON.parse(readFileSync(new URL('heldout.json',folder),'utf8')),development=JSON.parse(readFileSync(new URL('development.json',folder),'utf8'))
 const exact=new Set([...development.map((x:{question:string})=>x.question),...Object.values(QUESTION_BANK).flatMap(b=>Object.values(b).flat())])
 for(const item of heldout)assert(!exact.has(item.question),'Overlap '+item.id)
 const protocol=JSON.parse(readFileSync(new URL('protocol.json',folder),'utf8'));assert.equal(createHash('sha256').update(readFileSync(fileURLToPath(new URL('heldout.json',folder)))).digest('hex'),protocol.heldoutSha256)
})
