// Separate browser-safe public question contract. Legacy index.ts/API1 remain frozen.
export type * from './question-types.ts'
export { QUESTION_API_VERSION, QUESTION_POLICY_VERSION, QUESTION_CONTEXT_VERSION, QUESTION_ENDPOINT,
  MAX_QUESTION_REQUEST_BYTES, MAX_QUESTION_RESPONSE_BYTES } from './question-types.ts'
export { createQuestionRequest, parseQuestionRequest, questionDigest, parseQuestionText } from './question-contract.ts'
export { answerQuestion, parseQuestionResponse } from './question-response.ts'
export type { QuestionExecution } from './question-response.ts'
export { createQuestionFeature } from './question-feature.ts'
export type { QuestionFeature } from './question-feature.ts'
export { QuestionApiError, QUESTION_ERROR_POLICY, parseQuestionError } from './question-errors.ts'
export { createLocalQuestionTransport, createMockQuestionTransport, createRemoteQuestionTransport, QuestionTransportError } from './question-transport.ts'
export type { QuestionTransport, QuestionTransportOptions } from './question-transport.ts'
export { createQuestionController } from './question-controller.ts'
export type { QuestionControllerOptions, QuestionControllerState, QuestionDelivery } from './question-controller.ts'
