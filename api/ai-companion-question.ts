import { createQuestionHandler } from '../src/ai/companion/server/question-handler.ts'

// Default OFF. Route export only: no production mount/proxy, credentials, provider or environment lookup.
export default createQuestionHandler()
