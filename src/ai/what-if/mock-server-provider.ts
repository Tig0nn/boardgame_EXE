import { mockGemini } from '../../../mobile_app/src/game/what-if-ai/mock-gemini.ts'
import type { WhatIfProvider } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { interpretMock, intentAlternativeId } from '../../../mobile_app/src/game/what-if-ai/natural-language.ts'

export const mockServerProvider: WhatIfProvider = {
  async interpret({ question }, signal) { signal.throwIfAborted(); return interpretMock(question) },
  async propose(input, signal) {
    const reply = await mockGemini.propose(input, signal)
    if (reply) return reply
    const extracted = interpretMock(input.question)
    if (extracted.status === 'intent') {
      const intent = extracted.intent
      const matches = input.catalog.filter(choice => (choice.kind === intent.kind || intent.kind === 'course' && choice.kind === 'advanced')
        && choice.alternativeId === intentAlternativeId(intent)
        && (!intent.sequence || choice.decisionId === `${choice.kind}:${intent.sequence}`))
      if (matches.length === 1) return { decisionId: matches[0].decisionId, alternativeId: matches[0].alternativeId }
    }
    const candidates = await Promise.all(input.catalog.map(choice => mockGemini.propose({ ...input, catalog: [choice] }, signal)))
    return { status: candidates.filter(Boolean).length > 1 ? 'ambiguous' : 'unsupported' }
  },
  explain: mockGemini.explain,
}
