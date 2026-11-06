import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {resolve,sep} from 'node:path'
import {semanticFixture} from '../../tests/helpers/semantic.ts'
import {classifySemantic,createSemanticRequest,answerSemantic,validateSemanticResponse} from '../../src/ai/companion/semantic-index.ts'
import {createGameplayRequest,answerGameplay} from '../../src/ai/companion/universal-index.ts'
import {createDraftRequest,answerDraft,isDraftQuestion} from '../../src/ai/companion/draft-index.ts'
const root=resolve('.'),qa=resolve(process.env.SEMANTIC_QA_DIR||'node_modules/.tmp/b18-semantic-v1');assert(qa.startsWith(resolve('node_modules/.tmp')+sep));fs.mkdirSync(qa,{recursive:true})
const folder='tests/fixtures/ai-companion/semantic-v1/',protocol=JSON.parse(fs.readFileSync(folder+'protocol.json','utf8')),bytes=fs.readFileSync(folder+'heldout.json');assert.equal(createHash('sha256').update(bytes).digest('hex'),protocol.heldoutSha256)
const cases=JSON.parse(bytes),results=[]
const routerSha256=createHash('sha256').update(fs.readFileSync('src/ai/companion/semantic/routing.ts')).digest('hex')
for(const item of cases){
 const {state,context}=semanticFixture(item),before=JSON.stringify(state),start=performance.now(),route=classifySemantic(item.question,context)
 const request=await createSemanticRequest(context,item.question,item.id),response=await answerSemantic(request);await validateSemanticResponse(response,request)
 const milliseconds=performance.now()-start
 assert.equal(JSON.stringify(state),before);assert.doesNotMatch(JSON.stringify(request),/"(?:rng|seed|jitter|defaultLap|historySeed|purchaseWarning)"/)
 const baseline=context.draft&&isDraftQuestion(item.question)?await answerDraft(await createDraftRequest(context.draft,item.question,item.id)):await answerGameplay(await createGameplayRequest(context.actual,item.question,item.id))
 const expectedRoute=item.status==='route',answered=['answered','limited'].includes(response.status),routeCorrect=route.status===item.status&&(!item.intent||route.intent===item.intent)&&(!item.scope||route.scope===item.scope)&&(!item.reason||route.reason===item.reason)
 results.push({id:item.id,fixture:item.fixture,question:item.question,expected:item,route,response,baselineStatus:baseline.status,routeCorrect,intentCorrect:expectedRoute&&route.status==='route'&&route.intent===item.intent,scopeCorrect:!item.scope||route.scope===item.scope,financialFalsePositive:!expectedRoute&&answered,milliseconds,grounded:true})
}
const supported=results.filter(r=>r.expected.status==='route'),unsupported=results.filter(r=>r.expected.status!=='route'),times=results.map(r=>r.milliseconds).sort((a,b)=>a-b)
const summary={datasetCount:results.length,heldoutSha256:protocol.heldoutSha256,routerSha256,strictRouteCorrect:results.filter(r=>r.routeCorrect).length,expectedSupported:supported.length,intentCorrect:supported.filter(r=>r.intentCorrect).length,expectedUnsupported:unsupported.length,rejectedWithoutFinancialClaim:unsupported.filter(r=>!r.financialFalsePositive).length,financialFalsePositives:unsupported.filter(r=>r.financialFalsePositive).length,baselineAnswered:results.filter(r=>r.baselineStatus==='answered').length,semanticAnswered:results.filter(r=>r.response.status==='answered').length,semanticLimited:results.filter(r=>r.response.status==='limited').length,groundedAndImmutable:results.length,latencyMs:{p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:times.at(-1)},modelAccuracy:'NOT MEASURED; no live model or fabricated predictions',benchmarkLimitation:protocol.limitation}
fs.writeFileSync(resolve(qa,'heldout-evaluation.json'),JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary,null,2));console.log('Route misses:',results.filter(r=>!r.routeCorrect).map(r=>r.id).join(', '))
