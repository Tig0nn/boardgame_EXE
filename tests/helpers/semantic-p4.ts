import type {SemanticCase} from './semantic.ts'
import {encounter,phaseState} from './universal.ts'
import {liveBondEncounter,ownedBusiness,fundingWith} from './draft.ts'
import {projectGameplayContext} from '../../src/ai/companion/universal-index.ts'
import {normalizeDraftInput,projectDraftContext} from '../../src/ai/companion/draft-index.ts'
import type {DraftInput} from '../../src/ai/companion/draft-index.ts'
export interface AcceptanceCase {id:string;fixture:string;question:string;draft:Partial<DraftInput>|null;expected:'safe-fallback'|'correct-answer';reason?:string}
export function acceptanceFixture(c:AcceptanceCase){
 const state=c.fixture==='bonds'?liveBondEncounter():c.fixture==='business'?ownedBusiness():c.fixture==='funding'?fundingWith(c.draft?.source??'debt'):['summary','rebalancing','forecast'].includes(c.fixture)?phaseState(c.fixture):c.fixture==='overview'?phaseState('rolling'):encounter(c.fixture==='personal'?'repair':c.fixture==='macro'?'credit-tightening':c.fixture)
 const first=state.market.stocks[0].id,second=state.market.stocks[1].id,question=c.question.replaceAll('$first',first).replaceAll('$second',second)
 const identity={sessionEpoch:'p4-acceptance',revision:3,draftId:'form',draftRevision:4},actual=projectGameplayContext(state,{sessionEpoch:identity.sessionEpoch,revision:identity.revision})
 const input=c.draft?normalizeDraftInput({...c.draft,symbolId:c.draft.symbolId==='$first'?first:c.draft.symbolId==='$second'?second:c.draft.symbolId}):null
 return {state,question,context:{actual,draft:input?projectDraftContext(state,identity,input):null}}
}
export type {SemanticCase}
