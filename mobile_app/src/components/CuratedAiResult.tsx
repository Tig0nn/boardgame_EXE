import { useEffect, useRef } from 'react'
import type { CuratedView } from '../game/curated-ai.ts'
import { CURATED_QUESTIONS } from '../game/curated-catalog.ts'
import { SemanticAiResult } from './SemanticAiResult.tsx'
import { EducationalAnswerContent } from './EducationalAnswerContent.tsx'
import { presentEducationalAnswer, educationalMissing } from './educational-ai-presentation.ts'

export function CuratedAiResult({ view, active }: { view: CuratedView; active: boolean }) {
  const response = view.semantic.isCurrent() ? view.semantic.response : null
  const question = CURATED_QUESTIONS.find(q => q.id === view.input.questionId && q.categoryId === view.input.categoryId)
  const region = useRef<HTMLElement>(null)
  useEffect(() => { if (active && (response || view.notice)) region.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [active, response, view.notice])
  if (!question || !response && !view.notice) return <SemanticAiResult view={view.semantic} active={active} />
  const answer = response ? presentEducationalAnswer(response, question) : educationalMissing(question, view.reason ?? undefined)
  return <section ref={region} className="semantic-result" data-guided-notice={view.notice ? view.reason : undefined} aria-label="Giải thích câu hỏi đã chọn" aria-live="polite" aria-busy={false}>
    <EducationalAnswerContent answer={answer} />
  </section>
}
