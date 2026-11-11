import type {CommandIdentity,EndingFacts,Metrics,Delta,WorkOptions} from './endgame-whatif-contract.ts'
export const GOLD_POLICY='gold-buy-to-skip-full-end.v1' as const
export const GOLD_CONTINUATION='eg1b-gold-explicit-followup.v1' as const
export const GOLD_FAIRNESS='F1-native-coupling.v1' as const
export const GOLD_LIMITS=Object.freeze({commands:200,followups:8,transcriptCharacters:32_768,choices:1,advancesPerGap:4,advances:200})
export type GoldSelection={sourceHash:string;configHash:string;engine:string;profile:string;schema:7;initialPolicy:typeof GOLD_POLICY;continuationPolicy:typeof GOLD_CONTINUATION;fairness:typeof GOLD_FAIRNESS;decision:CommandIdentity;eventContext:'gold'}
export type GoldRequest={source:string;selection:GoldSelection}
export type GoldChoice={kind:'gold-skip';optionId:'skip'}
export type GoldContext={phase:string;event:string|null;lap:number;turn:number;tile:number}
export type GoldBlocker={hash:string;command:CommandIdentity;sourceCursor:number;boundary:'before-command'|'after-command'|'phase-advance';commandApplied:boolean;context:GoldContext;reason:string;engineReason:string|null;externalEqual:boolean;actualGoldUnits:number;alternativeGoldUnits:number;actualSaleLegal:boolean;alternativeUnchanged:boolean;choices:{action:GoldChoice;label:string}[]}
export type GoldContinuationIdentity={branchId:string;selection:GoldSelection;initial:'skip';revision:number;transcriptHash:string;sourceCursor:number;alternativePrefixHash:string}
export type GoldRecord={ordinal:number;sourceCursor:number;command:CommandIdentity;blockerHash:string;choice:GoldChoice;preStateHash:string;postStateHash:string;actualAction:CommandIdentity;alternativeAction:CommandIdentity;nextSourceCursor:number;previousHash:string;hash:string}
export type GoldTranscript={branchId:string;selection:GoldSelection;initial:'skip';entries:GoldRecord[];hash:string}
export type GoldQuote={gross:number;spread:number;fee:number;net:number}
export type GoldLedgerEntry={sourceCursor:number;sourceCommand:CommandIdentity;mode:'initial-fork'|'retained'|'explicit-followup';actualCommand:CommandIdentity;alternativeCommand:CommandIdentity;actualApplications:1;alternativeApplications:1;saleCosts:{actual:GoldQuote;alternative:GoldQuote|null}|null}
export type GoldMetrics=Metrics&{gold:{units:number;book:number;basis:number}}
export type GoldResult=
 |{status:'needs-followup';waitingForChoice:true;selection:GoldSelection;continuation:GoldContinuationIdentity;blocker:GoldBlocker;transcript:GoldTranscript}
 |{status:'supported-final';selection:GoldSelection;continuation:GoldContinuationIdentity;transcript:GoldTranscript;ledger:GoldLedgerEntry[];comparability:'same-completed-horizon';actual:GoldMetrics;alternative:GoldMetrics;delta:Delta;endings:{actual:EndingFacts;alternative:EndingFacts};costs:{sourceSequence:number;actual:GoldQuote;alternative:GoldQuote|null}[];attribution:{initialFork:typeof GOLD_POLICY;initialCommand:CommandIdentity;followupCount:number;followups:{ordinal:number;command:CommandIdentity;choice:GoldChoice}[];combinedConsequences:boolean};proof:{actualReplay:true;alternativeReplay:true;alternativeExportHash:string;externalCheckpoints:number;phaseAdvances:number;steps:number;sourceUnchanged:true;reconstruction:{actual:1;coupled:1;independentAlternative:1}}}
 |{status:'limited';reason:string;transcript?:GoldTranscript;ledger?:GoldLedgerEntry[];blocker?:GoldBlocker;endings?:{actual:EndingFacts;alternative?:EndingFacts}}
 |{status:'blocked'|'cancelled'|'error';reason:string}
export type GoldResumeInput={continuation:GoldContinuationIdentity;blocker:GoldBlocker;choice:GoldChoice}
export type GoldContinuationHandle={readonly result:GoldResult;resume(input:GoldResumeInput,options?:WorkOptions):Promise<GoldResult>}
export type {WorkOptions}
