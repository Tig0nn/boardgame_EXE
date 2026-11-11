import type { CourseRequest, WorkOptions } from './endgame-whatif-contract.ts'
import { requireEndgame, WorkBudget } from './endgame-whatif-contract.ts'
import { canonical, digest, equalData } from './endgame-whatif-identity.ts'
import { captureDataIntegrity } from './endgame-whatif-integrity.ts'
import { CONTINUATION_POLICY, FAIRNESS_POLICY, EG1B_LIMITS } from './endgame-whatif-eg1b-contract.ts'
import type { Transcript, FollowupRecord } from './endgame-whatif-eg1b-contract.ts'
export function exactKeys(value: unknown, keys: string[]) {
  requireEndgame(value && typeof value === 'object' && !Array.isArray(value) && equalData(Object.keys(value).sort(), [...keys].sort()), 'unexpected-fields')
}
export function checkTranscript(t: Transcript) {
  captureDataIntegrity(t)
  exactKeys(t, ['branchId','sourceHash','configHash','engine','selected','policy','fairness','entries','hash'])
  requireEndgame(typeof t.branchId === 'string' && /^[a-f0-9-]{36}$/.test(t.branchId) && t.policy === CONTINUATION_POLICY && t.fairness === FAIRNESS_POLICY, 'transcript-identity')
  requireEndgame(Array.isArray(t.entries) && t.entries.length <= EG1B_LIMITS.followups && canonical(t).length <= EG1B_LIMITS.transcriptCharacters, 'transcript-budget')
}
export async function emptyTranscript(request: CourseRequest): Promise<Transcript> {
  const t = { branchId: crypto.randomUUID(), sourceHash: request.identity.sourceHash, configHash: request.identity.configHash, engine: request.identity.engine, selected: structuredClone(request.identity.decision), policy: CONTINUATION_POLICY, fairness: FAIRNESS_POLICY, entries: [] as FollowupRecord[], hash: '' }
  t.hash = await transcriptRoot(t)
  return t
}
export const transcriptRoot = (t: Transcript) => digest(canonical({ branchId:t.branchId,sourceHash:t.sourceHash,configHash:t.configHash,engine:t.engine,selected:t.selected,policy:t.policy,fairness:t.fairness }))
export const recordHash = (r: Omit<FollowupRecord, 'hash'>) => digest(canonical(r))


export async function appendRecord(t:Transcript, value:Omit<FollowupRecord,'hash'|'previousHash'|'ordinal'>) {
  requireEndgame(t.entries.length < EG1B_LIMITS.followups,'followup-budget')
  const row={...value,ordinal:t.entries.length+1,previousHash:t.hash},hash=await recordHash(row)
  const next={...t,entries:[...t.entries,{...row,hash}],hash}
  requireEndgame(canonical(next).length<=EG1B_LIMITS.transcriptCharacters,'transcript-budget')
  return next
}
export async function verifyTranscriptChain(t:Transcript,request:CourseRequest) {
  checkTranscript(t)
  requireEndgame(t.sourceHash===request.identity.sourceHash&&t.configHash===request.identity.configHash&&t.engine===request.identity.engine&&equalData(t.selected,request.identity.decision),'transcript-identity')
  let hash=await transcriptRoot(t)
  for(let i=0;i<t.entries.length;i++){
    const r=t.entries[i]
    exactKeys(r,['ordinal','blockerHash','command','boundary','action','beforeHash','afterHash','superseded','previousHash','hash'])
    const {hash:own,...body}=r
    requireEndgame(r.ordinal===i+1&&r.previousHash===hash&&own===await recordHash(body),'transcript-chain')
    hash=own
  }
  requireEndgame(t.hash===hash,'transcript-chain')
}
export function validateOptions(options:WorkOptions) {
  requireEndgame(options&&typeof options==='object'&&!Array.isArray(options)&&Object.getPrototypeOf(options)===Object.prototype,'work-options')
  requireEndgame(Reflect.ownKeys(options).every(key=>typeof key==='string'&&['signal','maxSteps','maxMilliseconds'].includes(key)
    &&'value' in Object.getOwnPropertyDescriptor(options,key)!), 'work-options')
  requireEndgame(options.signal===undefined||options.signal instanceof AbortSignal,'work-options')
  return new WorkBudget(options)
}

export function assertSubmission(head:import('./endgame-whatif-eg1b-contract.ts').ContinuationResult,input:import('./endgame-whatif-eg1b-contract.ts').ResumeInput) {
  captureDataIntegrity(input)
  exactKeys(input,['continuation','blocker','choice'])
  requireEndgame(head.status==='needs-followup','no-pending-blocker')
  requireEndgame(equalData(input.continuation,head.continuation)&&equalData(input.blocker,head.blocker),'stale-blocker')
}
