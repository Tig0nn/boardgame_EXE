import {validateGrounding} from './grounding.ts'
import {array,enumeration,integer,literal,nullable,object,plainText,text,invalid} from '../schema.ts'
import {canonicalJson,sha256} from '../serialization.ts'
import {parseQuestionText} from '../question-contract.ts'
import {FACTS,validSubject} from './facts.ts'
import {GAMEPLAY_CONTEXT,GAMEPLAY_POLICY,DOMAINS} from './types.ts'
import type {GameplayContext,GameplayFact,GameplayRequest} from './types.ts'
const eventIds=['bank','stocks','bonds','gold','business','course','repair','medical','family','credit-tightening','demand-boom','supply-recovery'] as const
const actions=['deposit','buy','sell','upgrade','skip','pay','defer','full','temporary','acknowledge','course-basic','course-advanced','repay','continue','fund-savings','fund-stocks','fund-bonds','fund-gold','fund-debt'] as const
const factSchema=object({code:enumeration(Object.keys(FACTS)),subject:text(32),value:integer(-Number.MAX_SAFE_INTEGER)})
export function parseGameplayFact(raw:unknown):GameplayFact {
 const f=factSchema(raw)
 if(!validSubject(f.subject)||(!['worth','liquid','courseNet','change'].includes(f.code)&&f.value<0))invalid()
 if(f.code==='owned'&&f.value>1||f.code==='creditState'&&f.value>3)invalid()
 if(['rate','coupon'].includes(f.code)&&f.value>10000)invalid()
 return f
}
const contextSchema=object({version:literal(GAMEPLAY_CONTEXT),profile:enumeration(['core-mvp-b18-v1','core-mvp-b18-multi-course-v1']),
 sessionEpoch:text(48,/^[A-Za-z0-9_-]+$/),revision:integer(),domain:enumeration(DOMAINS),
 phase:enumeration(['forecast','rolling','event','funding','summary','rebalancing']),eventId:nullable(enumeration(eventIds)),
 lap:integer(1,4),totalLaps:literal(4),turn:integer(),facts:array(parseGameplayFact,8,256),actions:array(enumeration(actions),0,24),resources:array(enumeration(['savings','stocks','bonds','gold','debt']),0,5),
 entries:array(object({label:plainText(160),amount:integer(-Number.MAX_SAFE_INTEGER)}),0,64)})
export function parseGameplayContext(raw:unknown):GameplayContext {
 const c=contextSchema(raw)
 if(c.phase==='event') {
  const expected=['repair','medical','family'].includes(c.eventId??'')?'personal':['credit-tightening','demand-boom','supply-recovery'].includes(c.eventId??'')?'macro':c.eventId
  if(expected!==c.domain)invalid()
 }else if(c.domain!==({rolling:'overview',forecast:'forecast',funding:'funding',summary:'summary',rebalancing:'rebalancing'} as const)[c.phase]||c.eventId!==null&&c.phase!=='funding')invalid()
 const keys=c.facts.map(f=>`${f.code}:${f.subject}`)
 if(new Set(keys).size!==keys.length||new Set(c.actions).size!==c.actions.length)invalid()
 for(const code of ['cash','debt','obligations','worth','liquid','target','salary','living'])if(!keys.includes(`${code}:overall`))invalid()
 if(c.entries.length&&!['summary','funding'].includes(c.domain))invalid()
 // Context is projected locally. Wire parsing validates shape, not authenticity of a client's market.
 if(new TextEncoder().encode(JSON.stringify(c)).length>64000)invalid()
 validateGrounding(c);return c
}
const hash=text(71,/^sha256:[0-9a-f]{64}$/)
const requestSchema=object({version:literal(1),policy:literal(GAMEPLAY_POLICY),requestId:text(),sessionEpoch:text(48,/^[A-Za-z0-9_-]+$/),revision:integer(),
 context:parseGameplayContext,contextDigest:hash,question:parseQuestionText,questionDigest:hash})
export async function parseGameplayRequest(raw:unknown):Promise<GameplayRequest> {
 const r=requestSchema(raw)
 if(r.sessionEpoch!==r.context.sessionEpoch||r.revision!==r.context.revision)invalid()
 const [c,q]=await Promise.all([sha256(canonicalJson(r.context)),sha256(r.question)])
 if(c!==r.contextDigest||q!==r.questionDigest)invalid()
 return r
}
export async function createGameplayRequest(raw:unknown,question:unknown,requestId:unknown):Promise<GameplayRequest> {
 const context=parseGameplayContext(raw),q=parseQuestionText(question),id=text()(requestId)
 const [contextDigest,questionDigest]=await Promise.all([sha256(canonicalJson(context)),sha256(q)])
 return parseGameplayRequest({version:1,policy:GAMEPLAY_POLICY,requestId:id,sessionEpoch:context.sessionEpoch,revision:context.revision,context,contextDigest,question:q,questionDigest})
}