export const SEMANTIC_POLICY='b18-semantic-question.v1' as const
export const INTENTS=['explain','compare','risk','cashflow','learn'] as const
export const FOCUSES=['general','fees','liquidity','sale','income','maturity','breakeven','obligation','draft'] as const
export const ROUTE_REASONS=['supported','ambiguous','multi-intent','unsupported','outside-game','future','policy','cross-domain','draft-missing','draft-mismatch','amount-mismatch','missing-data','breakeven-unknown'] as const
export interface SemanticRoute {
 status:'route'|'clarify'|'reject';reason:typeof ROUTE_REASONS[number]
 scope:'actual'|'draft'|null;intent:typeof INTENTS[number]|null;focus:typeof FOCUSES[number]
 polarity:'positive'|'negative';mentionedAmount:number|null;term:1|2|3|null
 asset:'gold'|'stocks'|'bonds'|'bank'|'business'|'course'|null
 symbolId:string|null;issuerId:'an-tam'|'but-pha'|null
}
export interface SemanticContext {actual:import('../universal/types.ts').GameplayContext;draft:import('../draft/types.ts').DraftContext|null}
export interface SemanticRequest {
 version:1;policy:typeof SEMANTIC_POLICY;requestId:string;sessionEpoch:string;revision:number
 context:SemanticContext;contextDigest:string;question:string;questionDigest:string
}
export interface SemanticResponse {
 version:1;policy:typeof SEMANTIC_POLICY;requestId:string;sessionEpoch:string;revision:number;contextDigest:string;questionDigest:string
 source:'deterministic';status:'answered'|'limited'|'clarify'|'fallback';route:SemanticRoute;notice:string
 gameplay:import('../universal/types.ts').GameplayResponse|null;draft:import('../draft/types.ts').DraftResponse|null
}
