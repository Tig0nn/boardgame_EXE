import {factValue} from '../../../src/ai/companion/universal-index.ts'
import {useContext,useId,useRef,useState,useSyncExternalStore} from 'react'
import type {KeyboardEvent,ReactNode} from 'react'
import {GameplayAiContext} from './gameplay-ai-context.ts'
import {universalAiFeature} from '../game/universal-ai-feature.ts'
import type {GameplayView} from '../game/universal-ai.ts'
import {GameplayAiContent} from './GameplayAi.tsx'
const empty:GameplayView={context:null,question:'',status:'disabled',response:null,isCurrent:()=>false}
const noop=()=>()=>{},getEmpty=()=>empty
export function useGameplayAiSlots(children:ReactNode,baseFixed?:ReactNode,baseFooter?:ReactNode) {
 const binding=useContext(GameplayAiContext)
 const view=useSyncExternalStore(binding?.subscribe??noop,binding?.getSnapshot??getEmpty,getEmpty)
 const enabled=useSyncExternalStore(universalAiFeature.subscribe,universalAiFeature.isEnabled,()=>false)
 const [wantsAi,setWantsAi]=useState<string|null>(null)
 const decision=useRef<HTMLButtonElement>(null),ai=useRef<HTMLButtonElement>(null),id=useId()
 const available=!!binding&&!!view.context&&enabled
 const contextKey=view.context?`${view.context.sessionEpoch}:${view.context.revision}`:null
 const active=available&&wantsAi===contextKey&&view.status!=='disabled'
 const select=(value:boolean,focus=false)=>{setWantsAi(value?contextKey:null);if(focus)(value?ai:decision).current?.focus({preventScroll:true})}
 const key=(event:KeyboardEvent<HTMLButtonElement>)=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();select(event.key==='End'||event.key!=='Home'&&!active,true)}}
 if(!available)return {body:children,fixed:baseFixed,footer:baseFooter,active:false,available:false}
 const cash=view.context!.facts.find(f=>f.code==='cash')!
 return {
  available:true,active,
  fixed:<><div className="gameplay-tabs" role="tablist" aria-label="Quyết định và giải thích trong game">
   <button type="button" role="tab" ref={decision} id={`${id}-decision-tab`} aria-controls={`${id}-decision`} aria-selected={!active} tabIndex={active?-1:0} onKeyDown={key} onClick={()=>select(false)}>Quyết định</button>
   <button type="button" role="tab" ref={ai} id={`${id}-ai-tab`} aria-controls={`${id}-ai`} aria-selected={active} tabIndex={active?0:-1} onKeyDown={key} onClick={()=>select(true)}>✨ Hỏi AI</button>
  </div><p className="gameplay-cash">Tiền mặt hiện có: <strong>{factValue(cash)}</strong></p>{!active&&baseFixed}</>,
  body:<><div className="gameplay-decision" role="tabpanel" id={`${id}-decision`} aria-labelledby={`${id}-decision-tab`} hidden={active} tabIndex={0}>{children}</div>
   <div role="tabpanel" id={`${id}-ai`} aria-labelledby={`${id}-ai-tab`} hidden={!active} tabIndex={0} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();select(false,true)}}}>
    <GameplayAiContent binding={binding!} view={view}/>
   </div></>,
  footer:active?<button type="button" className="gameplay-return" onClick={()=>select(false,true)}>← Quay lại Quyết định</button>:baseFooter,
 }
}
