import {createQuestionFeature} from '../../../src/ai/companion/question-feature.ts'
import {universalAiOptIn} from './universal-ai.ts'
// Explicit local development URL only. No production override or persistence.
export const universalAiRequested=universalAiOptIn(import.meta.env.DEV,typeof window==='undefined'?'':window.location.search)
export const universalAiFeature=createQuestionFeature(universalAiRequested)