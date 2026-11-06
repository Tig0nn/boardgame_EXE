import { classifySemantic } from '../../../src/ai/companion/semantic-index.ts'
import { parseSemanticContext } from '../../../src/ai/companion/semantic/contract.ts'
import { routeNotices } from '../../../src/ai/companion/semantic/answer.ts'
import type { SemanticContext, SemanticResponse } from '../../../src/ai/companion/semantic/types.ts'
import type { QuestionFeature } from '../../../src/ai/companion/question-feature.ts'
import { createSemanticBinding } from './semantic-ai.ts'
import type { SemanticTransport, SemanticView } from './semantic-ai.ts'
import type { GameplaySession } from './universal-ai.ts'
import type { DraftStore } from './draft-store.ts'
import { CURATED_QUESTIONS } from './curated-catalog.ts'
import type { CuratedQuestion } from './curated-catalog.ts'

export interface CuratedInput { categoryId: string; questionId: string }
export interface CuratedPlan { allowed: boolean; reason: string; notice: string }
export function planCuratedQuestion(raw: SemanticContext, question: CuratedQuestion): CuratedPlan {
  const c = parseSemanticContext(raw)
  const decline = (reason: string, notice = question.fallback): CuratedPlan => ({ allowed: false, reason, notice })
  if (!question.domains.includes(c.actual.domain)) return decline('domain-unavailable')
  if (question.requiredActions.some(action => !c.actual.actions.includes(action))) return decline('options-unavailable')
  if (question.requiredFacts.some(need => !c.actual.facts.some(f => f.code === need.code && (need.value === undefined || f.value === need.value)) || need.subjects?.some(subject => !c.actual.facts.some(f => f.code === need.code && f.subject === subject && (need.value === undefined || f.value === need.value))))) return decline('facts-missing')
  if (question.requiredDraft) {
    const d = c.draft
    if (!d?.selection || d.preview.status !== 'quoted' || Object.entries(question.requiredDraft).some(([key, value]) => d.selection?.[key as keyof typeof d.selection] !== value)) return decline('draft-missing')
  }
  const route = classifySemantic(question.text, c)
  if (route.status !== 'route') return decline('p5-' + route.reason, routeNotices[route.reason])
  if (route.intent !== question.intent || route.focus !== question.focus || route.scope !== question.scope) return decline('mapping-unavailable')
  return { allowed: true, reason: 'supported', notice: '' }
}
export interface CuratedView { input: Readonly<CuratedInput>; selectionRevision: number; notice: string | null; reason: string | null; semantic: SemanticView }
export function createCuratedBinding(session: GameplaySession, feature: QuestionFeature, store: DraftStore | null, transport?: SemanticTransport) {
  const semantic = createSemanticBinding(session, feature, store, () => {}, transport)
  const listeners = new Set<() => void>()
  let input: Readonly<CuratedInput> = Object.freeze({ categoryId: '', questionId: '' }), selectionRevision = 0
  let notice: string | null = null, reason: string | null = null, stopSemantic: (() => void) | undefined
  let view: CuratedView = Object.freeze({ input, selectionRevision, notice, reason, semantic: semantic.getSnapshot() })
  function publish() {
    view = Object.freeze({ input, selectionRevision, notice, reason, semantic: semantic.getSnapshot() })
    for (const fn of [...listeners]) { try { fn() } catch { /* Cancellation survives a host listener failure. */ } }
  }
  function cancel() { selectionRevision++; notice = reason = null; semantic.cancel(); publish() }
  return {
    getSnapshot: () => view,
    subscribe(fn: () => void) {
      listeners.add(fn)
      if (!stopSemantic) stopSemantic = semantic.subscribe(() => { notice = reason = null; publish() })
      return () => { listeners.delete(fn); if (!listeners.size) { const stop = stopSemantic; stopSemantic = undefined; stop?.() } }
    },
    cancel,
    selectCategory(categoryId: string) { input = Object.freeze({ categoryId, questionId: '' }); cancel() },
    selectQuestion(questionId: string) { input = Object.freeze({ ...input, questionId }); cancel() },
    reset() { input = Object.freeze({ categoryId: '', questionId: '' }); cancel() },
    async ask(): Promise<SemanticResponse | null> {
      cancel()
      if (!stopSemantic || !feature.isEnabled()) return null
      const question = CURATED_QUESTIONS.find(q => q.id === input.questionId && q.categoryId === input.categoryId)
      if (!question) return null
      const context = semantic.getSnapshot().context
      if (!context) { notice = question.fallback; reason = 'context-unavailable'; publish(); return null }
      let plan: CuratedPlan
      try { plan = planCuratedQuestion(context, question) }
      catch { notice = question.fallback; reason = 'context-invalid'; publish(); return null }
      if (!plan.allowed) { notice = plan.notice; reason = plan.reason; publish(); return null }
      // Only the exact catalog text enters P5; no keywords or fabricated context are added.
      return semantic.ask(question.text)
    },
  }
}
