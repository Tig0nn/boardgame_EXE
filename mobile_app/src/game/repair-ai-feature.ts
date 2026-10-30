import { createQuestionFeature } from '../../../src/ai/companion/question-index.ts'
import { repairAiOptIn } from './repair-ai.ts'

// Query opt-in is deliberately ignored by production builds. No persistence or credentials.
export const repairAiFeature = createQuestionFeature(repairAiOptIn(import.meta.env.DEV,
  typeof window === 'undefined' ? '' : window.location.search))