import { presentGameplay } from './ai-answer-presentation.ts'
import type { AnswerPresentation } from './ai-answer-presentation.ts'
import { factLabel, factValue } from '../../../src/ai/companion/universal/facts.ts'
import type { GameplayResponse } from '../../../src/ai/companion/universal/types.ts'
import type { SemanticRoute } from '../../../src/ai/companion/semantic/types.ts'
import type { GuidedQuestionInput } from '../game/guided-ai.ts'

/** Display only existing, validated response facts. No projection, quote or financial calculation. */
export function presentGuidedGameplay(response: GameplayResponse, route: SemanticRoute, input: Readonly<GuidedQuestionInput>, notice = ''): AnswerPresentation {
  const original = presentGameplay(response, route, notice)
  if (response.status !== 'answered' || input.selectedFocus !== 'money') return original
  if (input.selectedCategory === 'costs') {
    const facts = response.facts.filter(f => ['immediate', 'future', 'total', 'after', 'shortfall'].includes(f.code))
    if (!facts.length) return original
    return { ...original, details: facts.map(f => ({ key: `${f.code}:${f.subject}`, label: factLabel(f), value: factValue(f) })) }
  }
  if (input.selectedCategory !== 'finance') return original
  const codes = route.focus === 'liquidity' ? ['cash'] : route.focus === 'obligation' ? ['obligations', 'paymentTotal', 'remaining'] : route.focus === 'income' ? ['salary', 'living', 'received'] : ['cash', 'debt', 'obligations', 'salary', 'living', 'received', 'debtPaid']
  const facts = response.facts.filter(f => codes.includes(f.code))
  if (!facts.length) return original
  const primary = route.focus === 'liquidity' ? facts.find(f => f.code === 'cash') : route.focus === 'obligation' ? facts.find(f => f.code === 'obligations') : undefined
  const noticeParagraphs = notice && notice !== 'Giải thích bằng dữ kiện đã công bố; bạn tự quyết định.' ? [notice] : []
  return {
    lead: primary ? `${factLabel(primary)}: ${factValue(primary)}.` : undefined,
    paragraphs: noticeParagraphs,
    details: facts.map(f => ({ key: `${f.code}:${f.subject}`, label: factLabel(f), value: factValue(f) })),
  }
}
