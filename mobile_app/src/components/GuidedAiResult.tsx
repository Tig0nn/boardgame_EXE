import { useEffect, useRef } from 'react'
import type { GuidedView } from '../game/guided-ai.ts'
import { SemanticAiResult } from './SemanticAiResult.tsx'
import { AiAnswerContent } from './AiAnswerContent.tsx'
import { presentGuidedGameplay } from './guided-ai-presentation.ts'

export function GuidedAiResult({ view, active }: { view: GuidedView; active: boolean }) {
  const semantic = view.semantic, response = semantic.isCurrent() ? semantic.response : null
  const region = useRef<HTMLElement>(null)
  useEffect(() => { if (active && response) region.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }, [active, response])
  if (!response?.gameplay || response.gameplay.status !== 'answered' || view.input.selectedFocus !== 'money' || !['costs', 'finance'].includes(view.input.selectedCategory)) {
    return <SemanticAiResult view={semantic} active={active} />
  }
  return <section ref={region} className="semantic-result" aria-label="Giải thích theo lựa chọn" aria-live="polite" aria-busy={false}>
    <AiAnswerContent answer={presentGuidedGameplay(response.gameplay, response.route, view.input, response.notice)} />
  </section>
}
