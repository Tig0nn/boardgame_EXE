import {createContext} from 'react'
import type {createGameplayBinding} from '../game/universal-ai.ts'
export const GameplayAiContext=createContext<ReturnType<typeof createGameplayBinding>|null>(null)