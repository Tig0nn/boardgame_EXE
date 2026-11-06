import {object,literal,text,integer,nullable,enumeration,invalid} from '../schema.ts'
import {parseQuestionText} from '../question-contract.ts'
import {parseGameplayContext} from '../universal/contract.ts'
import {parseDraftContext} from '../draft/contract.ts'
import {canonicalJson,sha256} from '../serialization.ts'
import {SEMANTIC_POLICY,INTENTS,FOCUSES,ROUTE_REASONS} from './types.ts'
import type {SemanticContext,SemanticRequest,SemanticRoute} from './types.ts'
const contextSchema=object({actual:parseGameplayContext,draft:nullable(parseDraftContext)})
export function parseSemanticContext(raw:unknown):SemanticContext {
 const c=contextSchema(raw);if(c.draft&&canonicalJson(c.actual)!==canonicalJson(c.draft.actual))invalid();return c
}
const hash=text(71,/^sha256:[0-9a-f]{64}$/)
const schema=object({version:literal(1),policy:literal(SEMANTIC_POLICY),requestId:text(),sessionEpoch:text(48),revision:integer(),context:parseSemanticContext,contextDigest:hash,question:parseQuestionText,questionDigest:hash})
export async function parseSemanticRequest(raw:unknown):Promise<SemanticRequest>{const r=schema(raw);if(r.sessionEpoch!==r.context.actual.sessionEpoch||r.revision!==r.context.actual.revision||await sha256(canonicalJson(r.context))!==r.contextDigest||await sha256(r.question)!==r.questionDigest)invalid();return r}
export async function createSemanticRequest(raw:unknown,question:unknown,requestId:unknown):Promise<SemanticRequest>{const context=parseSemanticContext(raw),q=parseQuestionText(question);return parseSemanticRequest({version:1,policy:SEMANTIC_POLICY,requestId,sessionEpoch:context.actual.sessionEpoch,revision:context.actual.revision,context,contextDigest:await sha256(canonicalJson(context)),question:q,questionDigest:await sha256(q)})}

const routeSchema=object({status:enumeration(['route','clarify','reject']),reason:enumeration(ROUTE_REASONS),scope:nullable(enumeration(['actual','draft'])),intent:nullable(enumeration(INTENTS)),focus:enumeration(FOCUSES),polarity:enumeration(['positive','negative']),mentionedAmount:nullable(integer(1)),term:nullable(value=>value===1||value===2||value===3?value:invalid()),asset:nullable(enumeration(['gold','stocks','bonds','bank','business','course'])),symbolId:nullable(text(32)),issuerId:nullable(enumeration(['an-tam','but-pha']))})
export function parseSemanticRoute(raw:unknown):SemanticRoute{const r=routeSchema(raw);if(r.status==='route'?r.scope===null||r.intent===null||!['supported','breakeven-unknown'].includes(r.reason):r.scope!==null||r.intent!==null)invalid();return r}
