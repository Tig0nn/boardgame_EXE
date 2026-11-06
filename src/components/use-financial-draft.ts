import {useContext,useEffect,useId} from 'react'
import type {GameState} from '../game/types.ts'
import type {DraftInput} from '../ai/companion/draft-index.ts'
import {normalizeDraftInput} from '../ai/companion/draft-index.ts'
import {FinancialDraftContext} from './financial-draft-context.ts'
/** Observes form input only. Never dispatches, changes a field or retains snapshots in wire context. */
export function useFinancialDraft(game:GameState,input:Partial<DraftInput>,active=true){
 const store=useContext(FinancialDraftContext),id=useId().replace(/[^a-zA-Z0-9_-]/g,'_'),owner=`form-${id}`
 const normalized=normalizeDraftInput(input),key=JSON.stringify(normalized)
 useEffect(()=>{
  if(active)store?.publish(owner,game,JSON.parse(key) as DraftInput)
  return()=>store?.clear(owner)
 },[active,game,store,owner,key])
 return {publish(patch:Partial<DraftInput>={}){store?.publish(owner,game,normalizeDraftInput({...normalized,...patch}))},clear(){store?.clear(owner)}}
}
