import type {DraftInput} from '../../src/ai/companion/draft-index.ts'
import {encounter,phaseState} from './universal.ts'
import {projectGameplayContext} from '../../src/ai/companion/universal-index.ts'
import {normalizeDraftInput,projectDraftContext} from '../../src/ai/companion/draft-index.ts'
export interface SemanticCase {id:string;fixture:string;question:string;draft?:Partial<DraftInput>;status:string;scope?:string;intent?:string;reason?:string}
export function semanticFixture(c:SemanticCase){
 const s=['funding','summary','rebalancing','forecast'].includes(c.fixture)?phaseState(c.fixture):c.fixture==='overview'?phaseState('rolling'):encounter(c.fixture==='personal'?'repair':c.fixture==='macro'?'credit-tightening':c.fixture)
 const id={sessionEpoch:'semantic-eval',revision:1,draftId:'form',draftRevision:1},actual=projectGameplayContext(s,{sessionEpoch:id.sessionEpoch,revision:id.revision}),draft=c.draft?projectDraftContext(s,id,normalizeDraftInput(c.draft)):null
 return {state:s,context:{actual,draft}}
}
