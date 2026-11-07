import {readFileSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {replayGameLog} from './replay-game-log.ts'
const baseline=JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json','utf8'))
const results=[]
for(const item of baseline.results){
 const bytes=readFileSync(item.path),sha256=createHash('sha256').update(bytes).digest('hex')
 assert.equal(sha256,item.sha256)
 const data=JSON.parse((item.path.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'))
 replayGameLog(data)
 results.push({path:item.path,sha256,matched:true})
}
assert.equal(results.length,81)
writeFileSync('docs/playtests/b18-release-qa/historical-replays.json',JSON.stringify({scope:'Frozen list of 81 natural historical replays from exact release base; new QA games are verified separately.',passed:results.length,failures:0,results},null,2)+'\n')
console.log(JSON.stringify({passed:results.length,failures:0}))
