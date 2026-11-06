import {createContext} from 'react'
import type {DraftStore} from '../../mobile_app/src/game/draft-store.ts'
export const FinancialDraftContext=createContext<DraftStore|null>(null)
