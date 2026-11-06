import { classifySemantic } from '../../../src/ai/companion/semantic-index.ts'
import { parseSemanticContext } from '../../../src/ai/companion/semantic/contract.ts'
import { routeNotices } from '../../../src/ai/companion/semantic/answer.ts'
import { extractExplicitSlots } from '../../../src/ai/companion/semantic/safety.ts'
import { normalizeQuestion } from '../../../src/ai/companion/universal/questions.ts'
import type { SemanticContext, SemanticResponse, SemanticRoute } from '../../../src/ai/companion/semantic-index.ts'
import type { QuestionFeature } from '../../../src/ai/companion/question-feature.ts'
import type { GameplaySession } from './universal-ai.ts'
import type { DraftStore } from './draft-store.ts'
import { createSemanticBinding } from './semantic-ai.ts'
import type { SemanticTransport, SemanticView } from './semantic-ai.ts'

export const GUIDED_CATEGORIES = [
  { value: 'bank', label: 'Ngân hàng / Tiết kiệm', domains: ['bank'] },
  { value: 'stocks', label: 'Cổ phiếu', domains: ['stocks'] },
  { value: 'bonds', label: 'Trái phiếu', domains: ['bonds'] },
  { value: 'business', label: 'Kinh doanh', domains: ['business'] },
  { value: 'costs', label: 'Chi phí / Sự kiện', domains: ['personal', 'macro', 'funding'] },
  { value: 'finance', label: 'Tài chính cá nhân', domains: [] },
] as const
export const GUIDED_FOCUSES = [
  { value: 'explain', label: 'Giải thích luật và cơ chế', intent: 'explain' },
  { value: 'money', label: 'Số tiền / Chi phí / Nghĩa vụ', intent: 'cashflow' },
  { value: 'risk', label: 'Rủi ro và lưu ý', intent: 'risk' },
  { value: 'compare', label: 'So sánh phương án', intent: 'compare' },
] as const
export interface GuidedQuestionInput { selectedCategory: string; selectedFocus: string; originalQuestion: string }
export const emptyGuidedInput = (): GuidedQuestionInput => ({ selectedCategory: '', selectedFocus: '', originalQuestion: '' })
export function guidedInputComplete(input: GuidedQuestionInput): boolean {
  return GUIDED_CATEGORIES.some(x => x.value === input.selectedCategory) && GUIDED_FOCUSES.some(x => x.value === input.selectedFocus) &&
    typeof input.originalQuestion === 'string' && input.originalQuestion.trim().length > 0 && input.originalQuestion.length <= 400
}
export interface GuidedPlan { allowed: boolean; reason: string; notice: string; route?: SemanticRoute }

/** Selection is a restrictive gate. It never changes a P5 route, context, question or response. */
export function planGuidedQuestion(rawContext: SemanticContext, input: GuidedQuestionInput): GuidedPlan {
  const decline = (reason: string, notice: string): GuidedPlan => ({ allowed: false, reason, notice })
  if (!guidedInputComplete(input)) return decline('incomplete', 'Hãy chọn loại ô, mục đích và nhập câu hỏi tối đa 400 ký tự.')
  const context = parseSemanticContext(rawContext)
  const route = classifySemantic(input.originalQuestion, context)
  // P4 refusal has priority over every menu selection.
  if (['policy', 'future', 'outside-game', 'multi-intent', 'draft-missing', 'draft-mismatch', 'amount-mismatch', 'ambiguous'].includes(route.reason)) {
    return decline('p5-' + route.reason, routeNotices[route.reason])
  }
  const category = GUIDED_CATEGORIES.find(x => x.value === input.selectedCategory)!
  if (category.value !== 'finance' && !(category.domains as readonly string[]).includes(context.actual.domain)) {
    return decline('category-unavailable', `Chưa có dữ kiện phù hợp cho ${category.label.toLocaleLowerCase('vi')} trong trạng thái này. Hãy chọn chủ đề có dữ kiện được hỗ trợ, hoặc hỏi khi mở phương án tương ứng.`)
  }
  // P5 does not resolve medical/family names across personal events. Do not substitute another event's costs.
  const text = normalizeQuestion(input.originalQuestion)
  const namedEvents = [
    { id: 'medical', pattern: /kham|chua benh|y te/ },
    { id: 'repair', pattern: /sua xe|sua tam/ },
    { id: 'family', pattern: /gia dinh/ },
  ].filter(x => x.pattern.test(text))
  if (namedEvents.some(x => x.id !== context.actual.eventId)) return decline('event-mismatch', 'Câu hỏi nhắc đến sự kiện khác với dữ kiện đang được công bố. Chưa có chi phí hợp lệ cho sự kiện đó.')
  if (route.status !== 'route') return decline('p5-' + route.reason, routeNotices[route.reason])
  if (category.value === 'finance') {
    const slots = extractExplicitSlots(input.originalQuestion, context)
    const financialFocus = ['general', 'liquidity', 'income', 'obligation']
    const commonDomain = ['overview', 'forecast', 'summary', 'funding', 'rebalancing'].includes(context.actual.domain)
    const commonMoney = input.selectedFocus === 'money' && ['liquidity', 'income', 'obligation'].includes(route.focus)
    if (slots.assets.length || route.scope !== 'actual' || !financialFocus.includes(route.focus) || !commonDomain && !commonMoney) {
      return decline('category-mismatch', 'Tài chính cá nhân chỉ dùng dữ kiện tài chính chung đã công bố. Hãy chọn đúng chủ đề nếu hỏi một tài sản hoặc phương án đang nhập.')
    }
  }
  const focus = GUIDED_FOCUSES.find(x => x.value === input.selectedFocus)!
  if (route.intent !== focus.intent) return decline('focus-mismatch', 'Mục đích đã chọn chưa khớp câu hỏi được hỗ trợ. Hãy làm rõ câu hỏi hoặc đổi mục đích; chưa có kết quả cho lựa chọn đó.')
  return { allowed: true, reason: 'supported', notice: '', route }
}

export interface GuidedView {
  input: Readonly<GuidedQuestionInput>; selectionRevision: number
  reason: string | null; notice: string | null; semantic: SemanticView
}
/** Owns selection identity; the underlying P5 binding still owns session/snapshot/draft delivery. */
export function createGuidedBinding(session: GameplaySession, feature: QuestionFeature, store: DraftStore | null, transport?: SemanticTransport) {
  const semantic = createSemanticBinding(session, feature, store, () => {}, transport)
  const listeners = new Set<() => void>()
  let input = Object.freeze(emptyGuidedInput()), selectionRevision = 0
  let reason: string | null = null, notice: string | null = null, stopSemantic: (() => void) | undefined
  let view: GuidedView = Object.freeze({ input, selectionRevision, reason, notice, semantic: semantic.getSnapshot() })
  function publish() {
    view = Object.freeze({ input, selectionRevision, reason, notice, semantic: semantic.getSnapshot() })
    for (const fn of [...listeners]) { try { fn() } catch { /* Listener errors cannot defeat cancellation. */ } }
  }
  function cancel() { selectionRevision++; reason = notice = null; semantic.cancel(); publish() }
  return {
    getSnapshot: () => view,
    subscribe(fn: () => void) {
      listeners.add(fn)
      if (!stopSemantic) stopSemantic = semantic.subscribe(() => {
        // Selection notices also belong to the snapshot/draft that produced them.
        reason = notice = null
        publish()
      })
      return () => { listeners.delete(fn); if (!listeners.size) { const stop = stopSemantic; stopSemantic = undefined; stop?.() } }
    },
    cancel,
    edit(patch: Partial<GuidedQuestionInput>) {
      input = Object.freeze({
        selectedCategory: patch.selectedCategory ?? input.selectedCategory,
        selectedFocus: patch.selectedFocus ?? input.selectedFocus,
        originalQuestion: patch.originalQuestion ?? input.originalQuestion,
      })
      cancel()
    },
    async ask(): Promise<SemanticResponse | null> {
      cancel()
      if (!stopSemantic || !feature.isEnabled() || !guidedInputComplete(input)) return null
      const context = semantic.getSnapshot().context
      if (!context) { reason = 'context-unavailable'; notice = 'Chưa có dữ kiện hợp lệ cho trạng thái ván này.'; publish(); return null }
      let plan: GuidedPlan
      try { plan = planGuidedQuestion(context, input) }
      catch { reason = 'invalid-input'; notice = 'Câu hỏi hoặc dữ kiện chưa hợp lệ. Hãy kiểm tra lại.'; publish(); return null }
      if (!plan.allowed) { reason = plan.reason; notice = plan.notice; publish(); return null }
      // No menu labels, keywords or rewritten question enter the canonical request.
      return semantic.ask(input.originalQuestion)
    },
  }
}
