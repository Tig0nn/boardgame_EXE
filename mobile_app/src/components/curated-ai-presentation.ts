import type { CuratedQuestion } from '../game/curated-catalog.ts'
import type { GameplayResponse } from '../../../src/ai/companion/universal/types.ts'
import type { SemanticRoute } from '../../../src/ai/companion/semantic/types.ts'
import { factLabel, factValue } from '../../../src/ai/companion/universal/facts.ts'
import { presentGameplay } from './ai-answer-presentation.ts'
import { presentGuidedGameplay } from './guided-ai-presentation.ts'

/** Select facts from the canonical response only; catalog contains no financial answers. */
export function presentCuratedGameplay(response: GameplayResponse, route: SemanticRoute, question: CuratedQuestion, notice: string) {
  if (question.categoryId === 'finance') return presentGuidedGameplay(response, route, { selectedCategory: 'finance', selectedFocus: 'money', originalQuestion: question.text }, notice)
  const original = presentGameplay(response, route, notice)
  if (response.status !== 'answered') return original
  const details = response.facts.filter(f => question.displayFacts.includes(f.code)).map(f => ({ key: `${f.code}:${f.subject}`, label: factLabel(f), value: factValue(f) }))
  if (question.id === 'start-summary') response.entries.forEach((entry, index) => details.push({ key: `entry:${index}`, label: entry.label, value: `${entry.amount.toLocaleString('vi-VN')} đ` }))
  const paragraphs = question.displayFacts.length === 1 && question.displayFacts[0] === 'price' ? ['Giá đã công bố tại snapshot hiện tại:'] : original.paragraphs
  return { ...original, paragraphs, details }
}
