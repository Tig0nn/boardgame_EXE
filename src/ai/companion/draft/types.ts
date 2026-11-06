export const DRAFT_POLICY='b18-draft-question.v1' as const
export const DRAFT_CONTEXT='b18-financial-draft.v1' as const
export interface DraftInput {
 form:'investment'|'bank'|'rebalancing'|'business'|'funding'
 operation:'buy'|'sell'|'deposit'|'upgrade'|'fund'
 asset:'gold'|'stocks'|'bonds'|null
 amount:number|null
 symbolId:string|null
 issuerId:'an-tam'|'but-pha'|null
 lotId:string|null
 preferenceId:'checkin'|'budget'|'taste'|null
 source:'savings'|'stocks'|'gold'|'bonds'|'debt'|null
 term:1|2|3|null
}
export interface DraftIdentity {sessionEpoch:string;revision:number;draftId:string;draftRevision:number}
export interface DraftLine {code:'entered'|'price'|'payNow'|'cashAfter'|'gross'|'spread'|'fee'|'net'|'interest'|'maturity'|'term'|'principal'|'coupon'|'incremental'|'lost'|'used'|'pendingAfter'|'cashAfterStep'|'debtAfter';value:number}
export interface DraftPreview {status:'quoted'|'invalid'|'unavailable'|'unsupported'|'missing';reason:'supported'|'amount'|'cash'|'holding'|'selection'|'action'|'unsupported'|'missing';lines:DraftLine[]}
export interface DraftContext {
 version:typeof DRAFT_CONTEXT
 actual:import('../universal/types.ts').GameplayContext
 draftId:string;draftRevision:number;selection:DraftInput|null
 selectedAvailable:number|null
 lotSubject:string|null
 matchingPreferenceId:'checkin'|'budget'|'taste'|null
 preview:DraftPreview
}
export interface DraftRequest extends DraftIdentity {
 version:1;policy:typeof DRAFT_POLICY;requestId:string;context:DraftContext;contextDigest:string;question:string;questionDigest:string
}
export interface DraftResponse extends DraftIdentity {
 version:1;policy:typeof DRAFT_POLICY;requestId:string;contextDigest:string;questionDigest:string
 source:'deterministic';integrity:'client-state-unverified';status:'answered'|'fallback'
 reason:string;conclusion:string;explanation:string;lines:DraftLine[];limitations:string[]
}
