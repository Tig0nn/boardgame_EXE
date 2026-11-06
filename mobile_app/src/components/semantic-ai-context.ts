import {createContext} from 'react'
import type {createSemanticBinding,SemanticView} from '../game/semantic-ai.ts'
export const SemanticAiContext=createContext<ReturnType<typeof createSemanticBinding>|null>(null)
export const emptySemanticView:SemanticView={context:null,status:'disabled',response:null,isCurrent:()=>false}
export const emptySemanticSnapshot=()=>emptySemanticView
export const emptySemanticSubscribe=()=>()=>{}
