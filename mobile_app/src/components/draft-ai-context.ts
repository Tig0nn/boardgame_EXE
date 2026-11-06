import {createContext} from 'react'
import type {createDraftBinding,DraftView} from '../game/draft-ai.ts'
export const DraftAiContext=createContext<ReturnType<typeof createDraftBinding>|null>(null)
export const emptyDraftView:DraftView={context:null,status:'disabled',response:null,isCurrent:()=>false}
export const emptyDraftSnapshot=()=>emptyDraftView
export const emptyDraftSubscribe=()=>()=>{}
