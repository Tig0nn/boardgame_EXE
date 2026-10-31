// Browser-safe entry for the separately versioned local gameplay Companion.
export * from './universal/types.ts'
export {projectGameplayContext,gameplayEligible,gameplayContextReady} from './universal/projector.ts'
export {parseGameplayContext,parseGameplayRequest,createGameplayRequest} from './universal/contract.ts'
export {answerGameplay,validateGameplayResponse} from './universal/answer.ts'
export {QUESTION_BANK,suggestions,classifyGameplay} from './universal/questions.ts'
export {factLabel,factValue,actionLabel,resourceLabel} from './universal/facts.ts'